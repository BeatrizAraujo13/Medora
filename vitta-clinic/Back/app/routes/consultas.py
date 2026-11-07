"""Rotas REST de consultas."""

from datetime import date

from flask import Blueprint, request

from app.schemas.consulta import EsquemaConsulta, EsquemaAtualizacaoConsulta
from app.services.consultas import (
    criar_consulta,
    excluir_consulta,
    listar_consultas,
    atualizar_consulta,
)
from app.services.comum import obter_ou_404, carregar_dados
from app.models import Consulta
from app.utils.autenticacao import usuario_atual, perfis_obrigatorios
from app.utils.erros import ErroApi

bp = Blueprint("appointments", __name__, url_prefix="/appointments")


def _data_consultada(name):
    value = request.args.get(name)
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ErroApi(f"{name} deve estar no formato AAAA-MM-DD.", 400) from error


@bp.get("")
@perfis_obrigatorios("admin", "medico", "recepcionista")
def listar():
    status = request.args.get("status")
    if status and status not in {"agendada", "realizada", "cancelada"}:
        raise ErroApi("Status inválido.", 400)
    doctor_id = request.args.get("doctor_id")
    try:
        doctor_id = int(doctor_id) if doctor_id else None
    except ValueError as error:
        raise ErroApi("doctor_id deve ser um número inteiro.", 400) from error
    items = listar_consultas(
        usuario_atual(),
        date_from=_data_consultada("date_from"),
        date_to=_data_consultada("date_to"),
        status=status,
        doctor_id=doctor_id,
    )
    return {"items": [appointment.para_dicionario() for appointment in items]}


@bp.get("/mine")
@perfis_obrigatorios("paciente")
def minhas_consultas():
    patient_id = usuario_atual().patient.id
    appointments = (
        Consulta.query.filter_by(patient_id=patient_id)
        .order_by(Consulta.appointment_date, Consulta.appointment_time)
        .all()
    )
    return {
        "items": [
            {
                "id": appointment.id,
                "patient_id": appointment.patient_id,
                "patient_name": appointment.patient.name,
                "doctor_id": appointment.doctor_id,
                "doctor_name": appointment.doctor.name,
                "specialty_id": appointment.doctor.specialty_id,
                "date": appointment.appointment_date.isoformat(),
                "time": appointment.appointment_time.strftime("%H:%M"),
                "status": appointment.status.value,
            }
            for appointment in appointments
        ]
    }


@bp.post("")
@perfis_obrigatorios("admin", "recepcionista")
def criar():
    appointment = criar_consulta(carregar_dados(EsquemaConsulta()))
    return {"appointment": appointment.para_dicionario()}, 201


@bp.get("/<int:appointment_id>")
@perfis_obrigatorios("admin", "medico", "recepcionista")
def obter(appointment_id):
    appointment = obter_ou_404(Consulta, appointment_id, "Consulta")
    user = usuario_atual()
    if user.role.value == "medico" and (not user.doctor or appointment.doctor_id != user.doctor.id):
        raise ErroApi("Consulta não encontrada.", 404)
    return {"appointment": appointment.para_dicionario()}


@bp.patch("/<int:appointment_id>")
@perfis_obrigatorios("admin", "medico", "recepcionista")
def atualizar(appointment_id):
    data = carregar_dados(EsquemaAtualizacaoConsulta(), partial=True)
    if not data:
        raise ErroApi("Informe ao menos um campo para atualizar.", 400)
    appointment = atualizar_consulta(appointment_id, data, usuario_atual())
    return {"appointment": appointment.para_dicionario()}


@bp.delete("/<int:appointment_id>")
@perfis_obrigatorios("admin", "recepcionista")
def excluir(appointment_id):
    excluir_consulta(appointment_id)
    return {"deleted": True}
