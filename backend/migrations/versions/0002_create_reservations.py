"""Add reservation history and active booking constraints.

Revision ID: 0002_create_reservations
Revises: 0001_create_users
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_create_reservations"
down_revision: Union[str, None] = "0001_create_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reservations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("seat_id", sa.String(length=250), nullable=False),
        sa.Column("seat_number", sa.String(length=32), nullable=False),
        sa.Column("tower", sa.String(length=64), nullable=False),
        sa.Column("parking_level", sa.String(length=64), nullable=False),
        sa.Column("vehicle_type", sa.String(length=32), nullable=False),
        sa.Column("reserved_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("unreserved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
    )
    op.create_index("ix_reservations_user_id", "reservations", ["user_id"])
    op.create_index(
        "uq_reservations_active_user",
        "reservations",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("unreserved_at IS NULL"),
    )
    op.create_index(
        "uq_reservations_active_seat",
        "reservations",
        ["seat_id"],
        unique=True,
        postgresql_where=sa.text("unreserved_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_reservations_active_seat", table_name="reservations")
    op.drop_index("uq_reservations_active_user", table_name="reservations")
    op.drop_index("ix_reservations_user_id", table_name="reservations")
    op.drop_table("reservations")
