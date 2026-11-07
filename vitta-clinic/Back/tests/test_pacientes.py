"""Testes de validação, unicidade e exclusão de pacientes."""


def dados_paciente(**overrides):
    payload = {
        "name": "Paciente de Teste",
        "cpf": "111.222.333-96",
        "birth_date": "1990-01-01",
        "phone": "(11) 90000-0000",
        "email": "paciente.teste@example.com",
        "address": "Rua de Teste, 10",
        "insurance": "Particular",
        "notes": "",
    }
    payload.update(overrides)
    return payload


def testar_paciente_exige_11_digitos_e_cpf_unico(cliente_teste, cabecalho_autenticacao):
    accepted = cliente_teste.post(
        "/api/v1/patients",
        headers=cabecalho_autenticacao,
        json=dados_paciente(cpf="123.456.789-00"),
    )
    assert accepted.status_code == 201

    malformed = cliente_teste.post(
        "/api/v1/patients",
        headers=cabecalho_autenticacao,
        json=dados_paciente(cpf="123.45a.789-00"),
    )
    assert malformed.status_code == 400

    duplicate = cliente_teste.post(
        "/api/v1/patients",
        headers=cabecalho_autenticacao,
        json=dados_paciente(cpf="12345678900"),
    )
    assert duplicate.status_code == 409


def testar_remocao_de_paciente_com_historico(cliente_teste, cabecalho_autenticacao):
    created = cliente_teste.post(
        "/api/v1/patients",
        headers=cabecalho_autenticacao,
        json=dados_paciente(),
    )
    assert created.status_code == 201
    patient_id = created.get_json()["patient"]["id"]
    removed = cliente_teste.delete(f"/api/v1/patients/{patient_id}", headers=cabecalho_autenticacao)
    assert removed.status_code == 200
    assert removed.get_json()["soft_deleted"] is False

    historical = cliente_teste.delete("/api/v1/patients/1", headers=cabecalho_autenticacao)
    assert historical.status_code == 200
    assert historical.get_json()["soft_deleted"] is True
    assert all(item["id"] != 1 for item in cliente_teste.get("/api/v1/patients", headers=cabecalho_autenticacao).get_json()["items"])
    assert any(
        item["id"] == 1
        for item in cliente_teste.get("/api/v1/patients?include_deleted=true", headers=cabecalho_autenticacao).get_json()["items"]
    )
