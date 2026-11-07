"""Rotas REST de pacientes."""

from flask import Blueprint, request

from app.models import Paciente, PerfilUsuario
from app.schemas.paciente import EsquemaPaciente, EsquemaAtualizacaoPaciente
from app.services.comum import obter_ou_404, carregar_dados
from app.services.pacientes import excluir_paciente, listar_pacientes, salvar_paciente
from app.utils.autenticacao import usuario_atual, perfis_obrigatorios
from app.utils.erros import ErroApi

bp = Blueprint("patients", __name__, url_prefix="/patients")


@bp.get("")
@perfis_obrigatorios("admin", "medico", "recepcionista")
def listar():
    user = usuario_atual()
    include_deleted = request.args.get("include_deleted") == "true"
    if include_deleted and user.role != PerfilUsuario.ADMIN:
        raise ErroApi("Apenas administradores podem consultar pacientes excluídos.", 403)
    items = listar_pacientes(request.args.get("search"), include_deleted)
    return {"items": [patient.para_dicionario() for patient in items]}


@bp.get("/me")
@perfis_obrigatorios("paciente")
def meu_cadastro():
    patient = usuario_atual().patient
    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "cpf": patient.cpf,
            "birth_date": patient.birth_date.isoformat(),
            "phone": patient.phone,
            "email": patient.email,
        }
    }


@bp.post("")
@perfis_obrigatorios("admin", "recepcionista")
def criar():
    patient = salvar_paciente(carregar_dados(EsquemaPaciente()))
    return {"patient": patient.para_dicionario()}, 201


@bp.get("/<int:patient_id>")
@perfis_obrigatorios("admin", "medico", "recepcionista")
def obter(patient_id):
    patient = obter_ou_404(Paciente, patient_id, "Paciente")
    if patient.deleted_at:
        raise ErroApi("Paciente não encontrado(a).", 404)
    return {"patient": patient.para_dicionario()}


@bp.patch("/<int:patient_id>")
@perfis_obrigatorios("admin", "recepcionista")
def atualizar(patient_id):
    patient = obter_ou_404(Paciente, patient_id, "Paciente")
    if patient.deleted_at:
        raise ErroApi("Não é possível editar um paciente excluído.", 409)
    data = carregar_dados(EsquemaAtualizacaoPaciente(), partial=True)
    if not data:
        raise ErroApi("Informe ao menos um campo para atualizar.", 400)
    return {"patient": salvar_paciente(data, patient).para_dicionario()}


@bp.delete("/<int:patient_id>")
@perfis_obrigatorios("admin", "recepcionista")
def excluir(patient_id):
    return excluir_paciente(patient_id)
