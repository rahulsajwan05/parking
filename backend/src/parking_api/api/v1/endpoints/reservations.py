from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from pydantic import EmailStr
from sqlalchemy.orm import Session

from parking_api.db.session import get_db_session
from parking_api.schemas.reservation import (
    ActiveReservationRead,
    ReservationCreate,
    ReservationRead,
    ReservationRelease,
    SeatFillEstimate,
)
from parking_api.services.reservation_service import ReservationService

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db_session)]


@router.post("", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def reserve_seat(payload: ReservationCreate, session: DbSession) -> ReservationRead:
    """Reserve one available seat and record its start time."""
    reservation = ReservationService(session).create(**payload.model_dump())
    return ReservationRead.model_validate(reservation)


@router.post("/{reservation_id}/unreserve", response_model=ReservationRead)
def unreserve_seat(
    reservation_id: int,
    payload: ReservationRelease,
    session: DbSession,
) -> ReservationRead:
    """Release a seat and save its end time and total booked duration."""
    reservation = ReservationService(session).release(
        reservation_id=reservation_id,
        email=str(payload.email),
    )
    return ReservationRead.model_validate(reservation)


@router.get("/active", response_model=list[ActiveReservationRead])
def list_active_reservations(
    email: Annotated[EmailStr, Header(alias="X-User-Email")],
    session: DbSession,
) -> list[ActiveReservationRead]:
    """List booked seats without exposing other users' email addresses."""
    rows = ReservationService(session).list_active(email=str(email))
    return [
        ActiveReservationRead(
            **ReservationRead.model_validate(reservation).model_dump(),
            reserved_by_me=is_mine,
        )
        for reservation, is_mine in rows
    ]


@router.get("/fill-estimates", response_model=list[SeatFillEstimate])
def list_fill_estimates(
    session: DbSession,
    time_zone: Annotated[str, Query(min_length=1, max_length=64)] = "UTC",
) -> list[SeatFillEstimate]:
    """Return per-seat typical reservation times from the past 14 days."""
    estimates = ReservationService(session).list_fill_estimates(time_zone=time_zone)
    return [SeatFillEstimate.model_validate(estimate) for estimate in estimates]


@router.get("/history", response_model=list[ReservationRead])
def list_reservation_history(
    email: Annotated[EmailStr, Header(alias="X-User-Email")],
    session: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ReservationRead]:
    """List a user's most recent reservations, including released bookings."""
    reservations = ReservationService(session).list_history(email=str(email), limit=limit)
    return [ReservationRead.model_validate(reservation) for reservation in reservations]
