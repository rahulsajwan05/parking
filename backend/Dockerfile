FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock README.md ./
COPY alembic.ini ./
COPY migrations ./migrations
COPY src ./src

RUN uv sync --frozen --no-dev

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn parking_api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
