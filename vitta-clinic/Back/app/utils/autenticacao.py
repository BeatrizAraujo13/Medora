"""Consulta de conta JWT e decorador reutilizável de proteção por perfil."""

from functools import wraps

from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensoes import db
from app.models import PerfilUsuario, Usuario
from app.utils.erros import ErroApi


def usuario_atual() -> Usuario:
    identity = get_jwt_identity()
    try:
        user = db.session.get(Usuario, int(identity))
    except (TypeError, ValueError):
        user = None
    if (
        user is None
        or not user.active
        or (
            user.role == PerfilUsuario.PACIENTE
            and (user.patient is None or user.patient.deleted_at is not None)
        )
    ):
        raise ErroApi("Usuário autenticado não encontrado ou inativo.", 401)
    return user


def perfis_obrigatorios(*roles: str):
    """Exige um token de acesso válido e um dos perfis de conta informados."""

    def decorador(view):
        @wraps(view)
        @jwt_required()
        def envolvida(*args, **kwargs):
            user = usuario_atual()
            if user.role.value not in roles:
                raise ErroApi("Você não tem permissão para esta operação.", 403)
            return view(*args, **kwargs)

        return envolvida

    return decorador
