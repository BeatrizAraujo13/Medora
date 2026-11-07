"""Funções auxiliares de validação do domínio."""

import re


def normalizar_cpf(value: str) -> str:
    """Retorna somente os dígitos do CPF."""
    return re.sub(r"\D", "", value or "")


def cpf_formato_valido(value: str) -> bool:
    """Aceita 11 dígitos ASCII, sem máscara ou no formato 000.000.000-00."""
    return bool(
        re.fullmatch(r"(?:[0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})", value or "")
    )


def cpf_valido(value: str) -> bool:
    """Valida o formato numérico de 11 dígitos sem validar os verificadores oficiais."""
    return value.isascii() and value.isdigit() and len(value) == 11


def normalizar_crm(value: str) -> str:
    """Padroniza o CRM no formato `UF 123456`."""
    normalized = re.sub(r"\s+", " ", (value or "").strip().upper())
    match = re.fullmatch(r"(?:CRM-)?([A-Z]{2})\s*[-/]?\s*(\d{4,8})", normalized)
    if not match:
        raise ValueError("CRM inválido. Use o formato CRM-UF 123456.")
    return f"{match.group(1)} {match.group(2)}"


def crm_valido(value: str) -> bool:
    """Informa se o CRM contém a sigla de um estado brasileiro e de 4 a 8 dígitos."""
    try:
        normalizar_crm(value)
    except ValueError:
        return False
    return True
