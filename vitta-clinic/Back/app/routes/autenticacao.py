"""Rotas de acesso, renovação, conta atual e cadastro de administrador."""

from flask import Blueprint, request
import time

from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from flask_jwt_extended.exceptions import JWTExtendedException
from sqlalchemy import func

from app.extensoes import db
from app.models import PerfilUsuario, TokenRevogado, Usuario
from app.schemas.autenticacao import (
    EsquemaConfirmarRedefinicaoSenha,
    EsquemaCriacaoUsuario,
    EsquemaLogin,
    EsquemaLogout,
    EsquemaSolicitarRedefinicaoSenha,
    EsquemaValidarRedefinicaoSenha,
)
from app.services.comum import carregar_dados
from app.services.redefinicao_senha import (
    redefinir_senha,
    solicitar_redefinicao,
    validar_token,
)
from app.services.usuarios import criar_usuario
from app.utils.autenticacao import usuario_atual, perfis_obrigatorios
from app.utils.erros import ErroApi

bp = Blueprint("auth", __name__, url_prefix="/auth")


def _par_de_tokens(user):
    claims = {
        "role": user.role.value,
        "doctor_id": user.doctor.id if user.doctor else None,
        "patient_id": user.patient.id if user.patient else None,
    }
    return {
        "access_token": create_access_token(identity=str(user.id), additional_claims=claims),
        "refresh_token": create_refresh_token(identity=str(user.id), additional_claims=claims),
        "user": user.para_dicionario(),
    }


@bp.post("/login")
def entrar():
    data = carregar_dados(EsquemaLogin())
    user = Usuario.query.filter(func.lower(Usuario.email) == data["email"].lower()).first()
    if (
        user is None
        or not user.active
        or not user.verificar_senha(data["password"])
        or (
            user.role == PerfilUsuario.PACIENTE
            and (user.patient is None or user.patient.deleted_at is not None)
        )
    ):
        raise ErroApi("E-mail ou senha inválidos.", 401)
    return _par_de_tokens(user)


@bp.post("/logout")
@jwt_required()
def sair():
    access_claims = get_jwt()
    data = carregar_dados(EsquemaLogout())
    try:
        refresh_claims = decode_token(data["refresh_token"])
    except (JWTExtendedException, TypeError, ValueError) as error:
        raise ErroApi("Token de renovação inválido.", 400) from error
    if (
        refresh_claims.get("type") != "refresh"
        or refresh_claims.get("sub") != get_jwt_identity()
    ):
        raise ErroApi("Token de renovação inválido.", 400)
    agora = int(time.time())
    db.session.add_all(
        [
            TokenRevogado(jti=access_claims["jti"], revoked_at=agora),
            TokenRevogado(jti=refresh_claims["jti"], revoked_at=agora),
        ]
    )
    db.session.commit()
    return {"message": "Sessão encerrada."}


@bp.post("/password-reset")
def solicitar_redefinicao_de_senha():
    data = carregar_dados(EsquemaSolicitarRedefinicaoSenha())
    limitado = solicitar_redefinicao(data["email"], request.remote_addr or "unknown")
    if limitado:
        raise ErroApi(
            "Muitas solicitações. Aguarde antes de tentar novamente.", 429
        )
    return {
        "message": (
            "Se houver uma conta associada a este e-mail, enviaremos "
            "um link para redefinir a senha."
        )
    }, 202


@bp.post("/password-reset/validate")
def validar_redefinicao_de_senha():
    data = carregar_dados(EsquemaValidarRedefinicaoSenha())
    return {"valid": validar_token(data["token"])}


@bp.post("/password-reset/confirm")
def confirmar_redefinicao_de_senha():
    data = carregar_dados(EsquemaConfirmarRedefinicaoSenha())
    redefinir_senha(data["token"], data["password"], data["confirm_password"])
    return {"message": "Senha redefinida com sucesso."}


@bp.post("/refresh")
@jwt_required(refresh=True)
def atualizar_token():
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
        raise ErroApi("Usuário inativo.", 401)
    return {
        "access_token": create_access_token(
            identity=str(user.id),
            additional_claims={
                "role": user.role.value,
                "doctor_id": user.doctor.id if user.doctor else None,
                "patient_id": user.patient.id if user.patient else None,
            },
        )
    }


@bp.get("/me")
@jwt_required()
def minha_conta():
    return {"user": usuario_atual().para_dicionario()}


@bp.post("/register")
@perfis_obrigatorios("admin")
def cadastrar():
    data = carregar_dados(EsquemaCriacaoUsuario())
    user = criar_usuario(data)
    return {"user": user.para_dicionario()}, 201
