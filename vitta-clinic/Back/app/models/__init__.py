"""Exportações dos modelos SQLAlchemy."""

from app.models.consulta import Consulta, StatusConsulta
from app.models.medico import Medico
from app.models.paciente import Paciente
from app.models.prontuario import Prontuario
from app.models.especialidade import Especialidade
from app.models.usuario import Usuario, PerfilUsuario
from app.models.redefinicao_senha import SolicitacaoRedefinicaoSenha
from app.models.token_revogado import TokenRevogado

__all__ = [
    "Consulta",
    "StatusConsulta",
    "Medico",
    "Prontuario",
    "Paciente",
    "Especialidade",
    "Usuario",
    "PerfilUsuario",
    "SolicitacaoRedefinicaoSenha",
    "TokenRevogado",
]
