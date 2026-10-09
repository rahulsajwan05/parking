from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ReservationCreate(BaseModel):
    email: EmailStr
    seat_id: str = Field(min_length=1, max_length=250)
    seat_number: str = Field(min_length=1, max_length=32)
    tower: str = Field(min_length=1, max_length=64)
    parking_level: str = Field(min_length=1, max_length=64)
    vehicle_type: Literal["Four-wheeler", "Two-wheeler"]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class ReservationRelease(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class ReservationRead(BaseModel):
    id: int
    seat_id: str
    seat_number: str
    tower: str
    parking_level: str
    vehicle_type: str
    reserved_at: datetime
    unreserved_at: datetime | None
    duration_seconds: int | None

    model_config = ConfigDict(from_attributes=True)


class ActiveReservationRead(ReservationRead):
    reserved_by_me: bool


class SeatFillEstimate(BaseModel):
    seat_id: str
    typical_reserved_time: str
    reservations_in_period: int
    period_days: int = 14
    time_zone: str
