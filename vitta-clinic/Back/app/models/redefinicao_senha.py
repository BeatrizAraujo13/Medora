"""Solicitações e tokens temporários de redefinição de senha."""

from app.extensoes import db


class SolicitacaoRedefinicaoSenha(db.Model):
    __tablename__ = "password_reset_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    email_digest = db.Column(db.String(64), nullable=False, index=True)
    ip_digest = db.Column(db.String(64), nullable=False, index=True)
    token_digest = db.Column(db.String(64), unique=True)
    created_at = db.Column(db.Integer, nullable=False, index=True)
    expires_at = db.Column(db.Integer)
    used_at = db.Column(db.Integer)
