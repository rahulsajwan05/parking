from fastapi import APIRouter

from parking_api.schemas.assistant import AvailabilityAnswer, AvailabilityQuestion
from parking_api.services.assistant_service import answer_availability

router = APIRouter()


@router.post("/availability", response_model=AvailabilityAnswer)
async def ask_about_availability(payload: AvailabilityQuestion) -> AvailabilityAnswer:
    """Ask the local LLM to phrase the current parking counts for the user."""
    return await answer_availability(payload)
