import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "GrantFlow"
    APP_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "grantflow_super_secret_jwt_key_2026_unauthorized_access_denied")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./grantflow.db")

    # Cloud Storage (DP-900 Unstructured Store: Azure Blob Storage)
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    AZURE_STORAGE_CONTAINER_NAME: str = os.getenv("AZURE_STORAGE_CONTAINER_NAME", "grantflow-invoices")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
