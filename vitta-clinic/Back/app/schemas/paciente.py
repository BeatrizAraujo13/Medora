"""Esquemas de requisição de pacientes."""

from marshmallow import fields, validate

from app.extensoes import EsquemaVazio


class EsquemaPaciente(EsquemaVazio):
    name = fields.String(required=True, validate=validate.Length(min=2, max=160))
    cpf = fields.String(
        required=True,
        validate=validate.Regexp(r"^(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$"),
    )
    birth_date = fields.Date(required=True)
    phone = fields.String(required=True, validate=validate.Length(min=8, max=32))
    email = fields.Email(allow_none=True)
    address = fields.String(allow_none=True, validate=validate.Length(max=300))
    insurance = fields.String(allow_none=True, validate=validate.Length(max=120))
    notes = fields.String(allow_none=True)


class EsquemaAtualizacaoPaciente(EsquemaVazio):
    name = fields.String(validate=validate.Length(min=2, max=160))
    cpf = fields.String(
        validate=validate.Regexp(r"^(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})$"),
    )
    birth_date = fields.Date()
    phone = fields.String(validate=validate.Length(min=8, max=32))
    email = fields.Email(allow_none=True)
    address = fields.String(allow_none=True, validate=validate.Length(max=300))
    insurance = fields.String(allow_none=True, validate=validate.Length(max=120))
    notes = fields.String(allow_none=True)
