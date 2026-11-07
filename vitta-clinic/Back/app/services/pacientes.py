"""Operações de pacientes e regras de exclusão lógica com histórico."""

from datetime import datetime, timezone

from sqlalchemy import or_

from app.extensoes import db
from app.models import Consulta, Prontuario, Paciente
from app.services.comum import confirmar_ou_reverter, obter_ou_404
from app.utils.erros import ErroApi
from app.utils.validadores import cpf_formato_valido, cpf_valido, normalizar_cpf


def listar_pacientes(search: str | None = None, include_deleted: bool = False):
    query = Paciente.query
    if not include_deleted:
        query = query.filter(Paciente.deleted_at.is_(None))
    if search:
        term = f"%{search.strip()}%"
        digits = normalizar_cpf(search)
        conditions = [Paciente.name.ilike(term)]
        if digits:
            conditions.append(Paciente.cpf.like(f"%{digits}%"))
        query = query.filter(or_(*conditions))
    return query.order_by(Paciente.name).all()


def salvar_paciente(data: dict, patient: Paciente | None = None) -> Paciente:
    cpf_original = data.get("cpf", patient.cpf if patient else "")
    if not cpf_formato_valido(cpf_original):
        raise ErroApi("CPF deve conter exatamente 11 números.", 400)
    cpf = normalizar_cpf(cpf_original)
    if not cpf_valido(cpf):
        raise ErroApi("CPF inválido.", 400)
    existing = Paciente.query.filter_by(cpf=cpf).first()
    if existing and existing.id != (patient.id if patient else None):
        raise ErroApi("Já existe um paciente com este CPF.", 409)
    if patient is None:
        patient = Paciente(cpf=cpf)
        db.session.add(patient)
    patient.cpf = cpf
    for field in ("name", "birth_date", "phone", "email", "address", "insurance", "notes"):
        if field in data:
            setattr(patient, field, data[field])
    confirmar_ou_reverter()
    return patient


def excluir_paciente(patient_id: int):
    patient = obter_ou_404(Paciente, patient_id, "Paciente")
    if patient.user:
        raise ErroApi(
            "Desvincule a conta de acesso antes de excluir este paciente.", 409
        )
    has_history = (
        db.session.query(Consulta.id).filter_by(patient_id=patient.id).first()
        or db.session.query(Prontuario.id).filter_by(patient_id=patient.id).first()
    )
    if has_history:
        patient.deleted_at = datetime.now(timezone.utc)
    else:
        db.session.delete(patient)
    confirmar_ou_reverter()
    return {"deleted": True, "soft_deleted": bool(has_history)}
