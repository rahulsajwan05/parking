from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from parking_api.db.session import get_db_session
from parking_api.schemas.user import UserCreate, UserRead
from parking_api.services.user_service import UserService

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db_session)]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def save_user_email(payload: UserCreate, session: DbSession) -> UserRead:
    """Create a user for a new email or return its existing record."""
    user = UserService(session).create_or_get_by_email(str(payload.email))
    return UserRead.model_validate(user)
