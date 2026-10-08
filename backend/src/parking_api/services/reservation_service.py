from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from parking_api.models.reservation import Reservation
from parking_api.models.user import User


class ReservationService:
    def __init__(self, session: Session):
        self.session = session

    def _get_user(self, email: str) -> User:
        user = self.session.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User email not found")
        return user

    def create(self, *, email: str, seat_id: str, seat_number: str, tower: str,
               parking_level: str, vehicle_type: str) -> Reservation:
        user = self._get_user(email)
        current = self.session.scalar(
            select(Reservation).where(
                Reservation.user_id == user.id,
                Reservation.unreserved_at.is_(None),
            )
        )
        if current is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Unreserve seat {current.seat_number} before choosing another seat",
            )

        seat_taken = self.session.scalar(
            select(Reservation.id).where(
                Reservation.seat_id == seat_id,
                Reservation.unreserved_at.is_(None),
            )
        )
        if seat_taken is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This seat is already reserved")

        reservation = Reservation(
            user_id=user.id,
            seat_id=seat_id,
            seat_number=seat_number,
            tower=tower,
            parking_level=parking_level,
            vehicle_type=vehicle_type,
        )
        self.session.add(reservation)
        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            current = self.session.scalar(
                select(Reservation).where(
                    Reservation.user_id == user.id,
                    Reservation.unreserved_at.is_(None),
                )
            )
            if current is not None:
                detail = f"Unreserve seat {current.seat_number} before choosing another seat"
            else:
                detail = "This seat is already reserved"
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from None

        self.session.refresh(reservation)
        return reservation

    def release(self, *, reservation_id: int, email: str) -> Reservation:
        user = self._get_user(email)
        reservation = self.session.scalar(
            select(Reservation)
            .where(Reservation.id == reservation_id)
            .with_for_update()
        )
        if reservation is None or reservation.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
        if reservation.unreserved_at is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reservation is already released")

        released_at = datetime.now(timezone.utc)
        reservation.unreserved_at = released_at
        reservation.duration_seconds = max(0, int((released_at - reservation.reserved_at).total_seconds()))
        self.session.commit()
        self.session.refresh(reservation)
        return reservation

    def list_active(self, *, email: str) -> list[tuple[Reservation, bool]]:
        user = self._get_user(email)
        reservations = self.session.scalars(
            select(Reservation)
            .where(Reservation.unreserved_at.is_(None))
            .order_by(Reservation.reserved_at.asc())
        ).all()
        return [(reservation, reservation.user_id == user.id) for reservation in reservations]

    def list_history(self, *, email: str, limit: int = 20) -> list[Reservation]:
        user = self._get_user(email)
        return list(self.session.scalars(
            select(Reservation)
            .where(Reservation.user_id == user.id)
            .order_by(Reservation.reserved_at.desc())
            .limit(limit)
        ).all())
