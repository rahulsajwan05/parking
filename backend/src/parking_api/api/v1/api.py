from fastapi import APIRouter

from parking_api.api.v1.endpoints import reservations, users

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
