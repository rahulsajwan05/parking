from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Parking API"
    database_url: str = "postgresql+psycopg://parking_user:password@localhost:5432/parking"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    google_api_key: str = ""
    google_model: str = "gemini-3.8-flash"
    parking_site_name: str = "Candor TechSpace, Noida Sector 62"
    parking_site_latitude: float = 28.63990556
    parking_site_longitude: float = 77.3528761
    parking_site_radius_meters: int = 300

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
