from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from parking_api.db.base import Base


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        Index(
            "uq_reservations_active_user",
            "user_id",
            unique=True,
            postgresql_where=text("unreserved_at IS NULL"),
        ),
        Index(
            "uq_reservations_active_seat",
            "seat_id",
            unique=True,
            postgresql_where=text("unreserved_at IS NULL"),
        ),
        Index("ix_reservations_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    seat_id: Mapped[str] = mapped_column(String(250), nullable=False)
    seat_number: Mapped[str] = mapped_column(String(32), nullable=False)
    tower: Mapped[str] = mapped_column(String(64), nullable=False)
    parking_level: Mapped[str] = mapped_column(String(64), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(32), nullable=False)
    reserved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    unreserved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
