# Parking API

FastAPI backend with PostgreSQL persistence, SQLAlchemy, Alembic migrations, and `uv` dependency management.

## Local setup

From the `backend` directory in PowerShell:

```powershell
Copy-Item .env.example .env
uv sync
docker compose up -d db
uv run alembic upgrade head
uv run uvicorn parking_api.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` to explore the API. The React app posts an email to `POST /api/v1/users`.

Reservation endpoints:

- `POST /api/v1/reservations` creates an active seat reservation.
- `POST /api/v1/reservations/{id}/unreserve` records the release time and booked duration.
- `GET /api/v1/reservations/active` lists occupied seats and identifies the caller's own seat without returning other users' emails. Pass the login email in the `X-User-Email` header.
- `GET /api/v1/reservations/history` returns up to 20 recent reservations with timestamps and duration. Pass the login email in the `X-User-Email` header.
- `GET /api/v1/reservations/fill-estimates` reports each spot's median reservation time over the last 14 days, using the requested `time_zone` query parameter (UTC by default).
- `POST /api/v1/assistant/availability` asks Google Gemini to summarize the live available and taken counts supplied by the dashboard.

The first request creates a user row; later requests for the same email return the existing row. Email addresses are normalized to lowercase. The endpoint stores an email but does not verify ownership or provide authentication.

## Configuration

Set `DATABASE_URL`, `CORS_ORIGINS`, and `GOOGLE_API_KEY` in `.env`. `GOOGLE_MODEL` defaults to `gemini-3.8-flash`. The local Compose database is named `parking` and uses the development credentials in `.env`; replace those credentials outside local development.
