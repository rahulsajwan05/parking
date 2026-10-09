import asyncio
from fastapi import HTTPException, status
from google import genai

from parking_api.core.config import get_settings
from parking_api.schemas.assistant import AvailabilityAnswer, AvailabilityQuestion


async def answer_availability(question: AvailabilityQuestion) -> AvailabilityAnswer:
    settings = get_settings()
    if not settings.google_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Gemini is not configured. Set GOOGLE_API_KEY in the backend environment.",
        )
    total_spots = question.available_spots + question.taken_spots
    prompt = (
        f"Parking facts: {question.available_spots} spots are available and "
        f"{question.taken_spots} spots are taken, out of {total_spots} total. "
        f"Answer this question briefly: {question.question.strip()} "
        "Use only these facts. Do not calculate or invent different counts."
    )

    client = genai.Client(api_key=settings.google_api_key)
    try:
        interaction = await asyncio.to_thread(
            client.interactions.create,
            model=settings.google_model,
            input=prompt,
            system_instruction=(
                "You are a concise parking availability assistant. "
                "Answer only from the supplied parking facts."
            ),
            generation_config={"temperature": 0.1, "max_output_tokens": 80},
            timeout=45,
        )
        content = (interaction.output_text or "").strip()
    except (TimeoutError, asyncio.TimeoutError) as error:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Google Gemini took too long to respond.",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google Gemini could not complete the request. Check the model and API configuration.",
        ) from error
    finally:
        client.close()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google Gemini returned an empty answer.",
        )

    return AvailabilityAnswer(
        answer=content,
        available_spots=question.available_spots,
        taken_spots=question.taken_spots,
        model=settings.google_model,
    )
