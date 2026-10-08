from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from parking_api.models.user import User


class UserService:
    def __init__(self, session: Session):
        self.session = session

    def create_or_get_by_email(self, email: str) -> User:
        normalized_email = email.strip().lower()
        statement = (
            insert(User)
            .values(email=normalized_email)
            .on_conflict_do_nothing(index_elements=[User.email])
        )
        self.session.execute(statement)
        self.session.commit()
        return self.session.scalar(select(User).where(User.email == normalized_email))
