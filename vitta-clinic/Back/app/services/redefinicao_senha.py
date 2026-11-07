"""Serviços para emissão, validação e consumo de tokens de redefinição."""

from email.message import EmailMessage
import hashlib
import hmac
import logging
import secrets
import smtplib
import time

from flask import current_app
from sqlalchemy import or_, update

from app.extensoes import db
from app.models import SolicitacaoRedefinicaoSenha, Usuario
from app.utils.erros import ErroApi

logger = logging.getLogger(__name__)


def _digest(valor: str) -> str:
    chave = current_app.config["SECRET_KEY"].encode("utf-8")
    return hmac.new(chave, valor.encode("utf-8"), hashlib.sha256).hexdigest()


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def _enviar_email(destinatario: str, link: str, nome: str) -> None:
    configuracao = current_app.config
    host = configuracao.get("SMTP_HOST")
    remetente = configuracao.get("SMTP_FROM_EMAIL")
    if not host or not remetente:
        raise RuntimeError("SMTP_HOST e SMTP_FROM_EMAIL precisam estar configurados.")

    mensagem = EmailMessage()
    mensagem["Subject"] = "Redefinição de senha — Medora"
    mensagem["From"] = remetente
    mensagem["To"] = destinatario
    mensagem.set_content(
        f"Olá, {nome}.\n\n"
        "Recebemos uma solicitação para redefinir a senha da sua conta Medora. "
        "Use o link abaixo em até 30 minutos:\n\n"
        f"{link}\n\n"
        "Se você não solicitou esta alteração, ignore este e-mail."
    )

    with smtplib.SMTP(
        host,
        configuracao.get("SMTP_PORT", 587),
        timeout=configuracao.get("SMTP_TIMEOUT", 10),
    ) as servidor:
        servidor.ehlo()
        if configuracao.get("SMTP_USE_TLS", True):
            servidor.starttls()
            servidor.ehlo()
        if configuracao.get("SMTP_USERNAME"):
            servidor.login(
                configuracao["SMTP_USERNAME"], configuracao.get("SMTP_PASSWORD") or ""
            )
        servidor.send_message(mensagem)


def solicitar_redefinicao(email: str, endereco_ip: str) -> bool:
    agora = int(time.time())
    email_normalizado = email.strip().lower()
    email_digest = _digest(f"email:{email_normalizado}")
    ip_digest = _digest(f"ip:{endereco_ip}")
    janela = current_app.config.get("PASSWORD_RESET_RATE_WINDOW_SECONDS", 60 * 60)
    SolicitacaoRedefinicaoSenha.query.filter(
        SolicitacaoRedefinicaoSenha.created_at < agora - janela
    ).delete(synchronize_session=False)

    recentes = SolicitacaoRedefinicaoSenha.query.filter(
        SolicitacaoRedefinicaoSenha.created_at >= agora - janela,
        or_(
            SolicitacaoRedefinicaoSenha.email_digest == email_digest,
            SolicitacaoRedefinicaoSenha.ip_digest == ip_digest,
        ),
    ).all()
    por_email = sum(item.email_digest == email_digest for item in recentes)
    por_ip = sum(item.ip_digest == ip_digest for item in recentes)
    limitado = (
        por_email >= current_app.config.get("PASSWORD_RESET_EMAIL_LIMIT", 3)
        or por_ip >= current_app.config.get("PASSWORD_RESET_IP_LIMIT", 10)
    )

    usuario = None
    token = None
    validade = None
    if not limitado:
        usuario = Usuario.query.filter(
            db.func.lower(Usuario.email) == email_normalizado,
            Usuario.active.is_(True),
        ).first()
        if usuario:
            token = secrets.token_urlsafe(32)
            validade = agora + current_app.config.get(
                "PASSWORD_RESET_TOKEN_TTL_SECONDS", 30 * 60
            )

    if not limitado:
        solicitacao = SolicitacaoRedefinicaoSenha(
            user_id=usuario.id if usuario else None,
            email_digest=email_digest,
            ip_digest=ip_digest,
            token_digest=_token_digest(token) if token else None,
            created_at=agora,
            expires_at=validade,
        )
        db.session.add(solicitacao)
    db.session.commit()

    if token and usuario:
        link = (
            f"{current_app.config.get('PASSWORD_RESET_PUBLIC_URL', 'http://localhost:5000')}"
            f"/redefinir-senha.html#token={token}"
        )
        try:
            _enviar_email(usuario.email, link, usuario.name)
        except (OSError, smtplib.SMTPException, RuntimeError, ValueError):
            logger.exception("Falha ao enviar e-mail de redefinição de senha.")

    return limitado


def validar_token(token: str) -> bool:
    solicitacao = SolicitacaoRedefinicaoSenha.query.filter_by(
        token_digest=_token_digest(token)
    ).first()
    if not solicitacao or solicitacao.used_at is not None:
        return False
    if solicitacao.expires_at is None or solicitacao.expires_at <= int(time.time()):
        return False
    usuario = db.session.get(Usuario, solicitacao.user_id)
    return usuario is not None and usuario.active


def redefinir_senha(token: str, senha: str, confirmacao: str) -> None:
    if senha != confirmacao:
        raise ErroApi("As senhas informadas não coincidem.", 400)
    if not any(caractere in "0123456789" for caractere in senha):
        raise ErroApi("A senha deve conter pelo menos um número.", 400)

    digest = _token_digest(token)
    agora = int(time.time())
    solicitacao = SolicitacaoRedefinicaoSenha.query.filter_by(
        token_digest=digest
    ).first()
    if not solicitacao or solicitacao.used_at is not None:
        raise ErroApi("Este link é inválido ou expirou. Solicite uma nova recuperação.", 400)
    if solicitacao.expires_at is None or solicitacao.expires_at <= agora:
        raise ErroApi("Este link é inválido ou expirou. Solicite uma nova recuperação.", 400)

    resultado = db.session.execute(
        update(SolicitacaoRedefinicaoSenha)
        .where(
            SolicitacaoRedefinicaoSenha.id == solicitacao.id,
            SolicitacaoRedefinicaoSenha.used_at.is_(None),
            SolicitacaoRedefinicaoSenha.expires_at > agora,
        )
        .values(used_at=agora)
    )
    if resultado.rowcount != 1:
        db.session.rollback()
        raise ErroApi("Este link é inválido ou expirou. Solicite uma nova recuperação.", 400)

    usuario = db.session.get(Usuario, solicitacao.user_id)
    if usuario is None or not usuario.active:
        db.session.rollback()
        raise ErroApi("Este link é inválido ou expirou. Solicite uma nova recuperação.", 400)

    usuario.definir_senha(senha)
    SolicitacaoRedefinicaoSenha.query.filter(
        SolicitacaoRedefinicaoSenha.user_id == usuario.id,
        SolicitacaoRedefinicaoSenha.token_digest.is_not(None),
        SolicitacaoRedefinicaoSenha.used_at.is_(None),
    ).update(
        {SolicitacaoRedefinicaoSenha.used_at: agora},
        synchronize_session=False,
    )
    db.session.commit()
