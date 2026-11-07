"""Configuração da aplicação baseada em variáveis de ambiente."""

import os


class Configuracao:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-this-secret-key-32")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-change-this-jwt-secret-32")
    DATA_ENCRYPTION_KEY = os.getenv("DATA_ENCRYPTION_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///vitta_clinic.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 30
    JWT_REFRESH_TOKEN_EXPIRES = 60 * 60 * 24 * 30
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "10"))
    PASSWORD_RESET_PUBLIC_URL = os.getenv(
        "PASSWORD_RESET_PUBLIC_URL", "http://localhost:5000"
    ).rstrip("/")
    PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60
    PASSWORD_RESET_EMAIL_LIMIT = 3
    PASSWORD_RESET_IP_LIMIT = 10
    PASSWORD_RESET_RATE_WINDOW_SECONDS = 60 * 60
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500"
        ).split(",")
        if origin.strip()
    ]
