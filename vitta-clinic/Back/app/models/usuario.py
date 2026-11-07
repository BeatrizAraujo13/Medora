"""Contas de usuário e definições de perfis."""

from datetime import datetime, timezone
from enum import Enum

from app.extensoes import bcrypt, db


class PerfilUsuario(str, Enum):
    ADMIN = "admin"
    MEDICO = "medico"
    RECEPCIONISTA = "recepcionista"
    PACIENTE = "paciente"


class Usuario(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(254), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.Enum(PerfilUsuario, values_callable=lambda enum: [item.value for item in enum]), nullable=False)
    patient_id = db.Column(
        db.Integer, db.ForeignKey("patients.id", ondelete="SET NULL"), unique=True
    )
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    doctor = db.relationship("Medico", back_populates="user", uselist=False)
    patient = db.relationship("Paciente", back_populates="user", uselist=False)

    def definir_senha(self, password: str) -> None:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("A senha não pode exceder 72 bytes.")
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def verificar_senha(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def para_dicionario(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value,
            "active": self.active,
            "doctor_id": self.doctor.id if self.doctor else None,
            "patient_id": self.patient.id if self.patient else None,
        }
