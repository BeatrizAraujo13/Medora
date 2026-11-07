"""Identificadores de JWT invalidados pelo logout."""

from app.extensoes import db


class TokenRevogado(db.Model):
    __tablename__ = "revoked_tokens"

    jti = db.Column(db.String(36), primary_key=True)
    revoked_at = db.Column(db.Integer, nullable=False)
