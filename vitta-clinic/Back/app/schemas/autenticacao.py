"""Esquemas de autenticação e conta."""

from marshmallow import ValidationError, fields, validate, validates_schema

from app.extensoes import EsquemaVazio


def _validar_tamanho_bcrypt(password):
    if len(password.encode("utf-8")) > 72:
        raise ValidationError("A senha não pode exceder 72 bytes.")


def _validar_senha_segura(password):
    _validar_tamanho_bcrypt(password)
    if not any(caractere in "0123456789" for caractere in password):
        raise ValidationError("A senha deve conter pelo menos um número.")


class EsquemaLogin(EsquemaVazio):
    email = fields.Email(required=True)
    password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=1, max=72), _validar_tamanho_bcrypt],
    )


class EsquemaLogout(EsquemaVazio):
    refresh_token = fields.String(required=True, load_only=True)



def _validar_senhas_correspondentes(data):
    password = data.get("password")
    confirmation = data.get("confirm_password")
    if password is not None and confirmation is not None and password != confirmation:
        raise ValidationError({"confirm_password": ["As senhas informadas não coincidem."]})


class EsquemaSolicitarRedefinicaoSenha(EsquemaVazio):
    email = fields.Email(required=True)


class EsquemaValidarRedefinicaoSenha(EsquemaVazio):
    token = fields.String(
        required=True,
        validate=validate.Regexp(r"^[A-Za-z0-9_-]{43}$"),
    )


class EsquemaConfirmarRedefinicaoSenha(EsquemaValidarRedefinicaoSenha):
    password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=12, max=72), _validar_senha_segura],
    )
    confirm_password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=12, max=72), _validar_senha_segura],
    )

    @validates_schema
    def validar_senhas(self, data, **_kwargs):
        _validar_senhas_correspondentes(data)


class EsquemaCriacaoUsuario(EsquemaVazio):
    name = fields.String(required=True, validate=validate.Length(min=2, max=120))
    email = fields.Email(required=True)
    password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=12, max=72), _validar_senha_segura],
    )
    confirm_password = fields.String(
        required=True,
        load_only=True,
        validate=[validate.Length(min=12, max=72), _validar_senha_segura],
    )
    role = fields.String(required=True, validate=validate.OneOf(["admin", "medico", "recepcionista", "paciente"]))
    patient_id = fields.Integer(load_default=None, allow_none=True)

    @validates_schema
    def validar_senhas(self, data, **_kwargs):
        _validar_senhas_correspondentes(data)


class EsquemaAtualizacaoUsuario(EsquemaVazio):
    name = fields.String(validate=validate.Length(min=2, max=120))
    email = fields.Email()
    role = fields.String(validate=validate.OneOf(["admin", "medico", "recepcionista", "paciente"]))
    active = fields.Boolean()
    password = fields.String(
        load_only=True,
        validate=[validate.Length(min=12, max=72), _validar_senha_segura],
    )
    confirm_password = fields.String(
        load_only=True,
        validate=[validate.Length(min=12, max=72), _validar_senha_segura],
    )
    patient_id = fields.Integer(allow_none=True)

    @validates_schema
    def validar_senhas(self, data, **_kwargs):
        _validar_senhas_correspondentes(data)
        if "password" in data and "confirm_password" not in data:
            raise ValidationError(
                {"confirm_password": ["Confirme a nova senha."]}
            )
        if "confirm_password" in data and "password" not in data:
            raise ValidationError({"password": ["Informe a nova senha."]})
