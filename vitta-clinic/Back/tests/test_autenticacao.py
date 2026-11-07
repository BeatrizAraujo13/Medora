"""Testes de autenticação e acesso por perfil."""

from urllib.parse import parse_qs, urlparse
import time

import pytest

from app.extensoes import db
from app.models import SolicitacaoRedefinicaoSenha, Usuario


def testar_login_e_atualizacao_de_token_dos_perfis_iniciais(cliente_teste, tokens_teste):
    for email in ("admin@vitta.com", "medico@vitta.com", "recepcao@vitta.com"):
        assert tokens_teste(email)["user"]["email"] == email

    refresh_token = tokens_teste()["refresh_token"]
    refreshed = cliente_teste.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert refreshed.status_code == 200
    assert refreshed.get_json()["access_token"]


def testar_registros_de_demonstracao_iniciais(cliente_teste, cabecalho_autenticacao):
    assert len(cliente_teste.get("/api/v1/patients", headers=cabecalho_autenticacao).get_json()["items"]) == 5
    assert len(cliente_teste.get("/api/v1/doctors", headers=cabecalho_autenticacao).get_json()["items"]) == 3
    assert len(cliente_teste.get("/api/v1/specialties", headers=cabecalho_autenticacao).get_json()["items"]) == 3
    assert len(cliente_teste.get("/api/v1/appointments", headers=cabecalho_autenticacao).get_json()["items"]) == 5
    assert len(cliente_teste.get("/api/v1/records", headers=cabecalho_autenticacao).get_json()["items"]) == 1


def testar_usuario_atual_exige_token_de_acesso(cliente_teste, tokens_teste):
    login_data = tokens_teste("recepcao@vitta.com")
    response = cliente_teste.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_data['access_token']}"},
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "recepcionista"
    assert cliente_teste.get("/api/v1/auth/me").status_code == 401


def testar_endpoints_administrativos_rejeitam_atendente(cliente_teste, tokens_teste):
    token_data = tokens_teste("recepcao@vitta.com")
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    assert cliente_teste.get("/api/v1/users", headers=headers).status_code == 403
    assert cliente_teste.get("/api/v1/specialties", headers=headers).status_code == 403
    assert cliente_teste.get("/api/v1/reports/patients", headers=headers).status_code == 403


@pytest.mark.parametrize("email", ("medico@vitta.com", "recepcao@vitta.com"))
def testar_perfis_de_funcionario_nao_acessam_endpoints_administrativos(
    cliente_teste, tokens_teste, email
):
    login_data = tokens_teste(email)
    headers = {"Authorization": f"Bearer {login_data['access_token']}"}

    assert cliente_teste.get("/api/v1/users", headers=headers).status_code == 403
    assert cliente_teste.get("/api/v1/specialties", headers=headers).status_code == 403
    assert cliente_teste.get("/api/v1/reports/patients", headers=headers).status_code == 403
    assert cliente_teste.get("/api/v1/patients", headers=headers).status_code == 200


def testar_administrador_cadastra_usuario_e_novo_login(cliente_teste, cabecalho_autenticacao):
    payload = {
        "name": "Novo Usuário",
        "email": "novo.usuario@example.com",
        "password": "SenhaInicial123",
        "confirm_password": "SenhaInicial123",
        "role": "recepcionista",
    }
    created = cliente_teste.post("/api/v1/auth/register", headers=cabecalho_autenticacao, json=payload)
    assert created.status_code == 201
    assert created.get_json()["user"]["role"] == "recepcionista"
    entrar = cliente_teste.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert entrar.status_code == 200


@pytest.mark.parametrize(
    "role",
    ("admin", "medico", "recepcionista"),
)
def testar_administrador_cria_usuarios_pelo_endpoint_de_usuarios(
    cliente_teste, cabecalho_autenticacao, role
):
    payload = {
        "name": f"Novo {role}",
        "email": f"novo.{role}@example.com",
        "password": "SenhaInicial123",
        "confirm_password": "SenhaInicial123",
        "role": role,
    }

    criado = cliente_teste.post(
        "/api/v1/users", headers=cabecalho_autenticacao, json=payload
    )
    login = cliente_teste.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )

    assert criado.status_code == 201
    assert criado.get_json()["user"]["role"] == role
    assert "password_hash" not in criado.get_json()["user"]
    assert login.status_code == 200


def testar_criacao_de_usuario_exige_administrador(
    cliente_teste, tokens_teste
):
    login = tokens_teste("recepcao@vitta.com")
    response = cliente_teste.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {login['access_token']}"},
        json={
            "name": "Tentativa não autorizada",
            "email": "nao.autorizado@example.com",
            "password": "SenhaInicial123",
            "confirm_password": "SenhaInicial123",
            "role": "recepcionista",
        },
    )

    assert response.status_code == 403


def testar_atendente_nao_cadastra_usuarios(cliente_teste, tokens_teste):
    token_data = tokens_teste("recepcao@vitta.com")
    response = cliente_teste.post(
        "/api/v1/auth/register",
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
        json={
            "name": "Outro Usuário",
            "email": "outro@example.com",
            "password": "SenhaInicial123",
            "confirm_password": "SenhaInicial123",
            "role": "recepcionista",
        },
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "email",
    ("admin@vitta.com", "medico@vitta.com", "recepcao@vitta.com"),
)
def testar_solicitacao_de_redefinicao_para_todos_os_perfis(
    cliente_teste, email, monkeypatch
):
    emails_enviados = []

    def enviar_email(destinatario, link, nome):
        emails_enviados.append((destinatario, link, nome))

    monkeypatch.setattr(
        "app.services.redefinicao_senha._enviar_email", enviar_email
    )
    resposta = cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": email}
    )

    assert resposta.status_code == 202
    assert "Se houver uma conta" in resposta.get_json()["message"]
    assert len(emails_enviados) == 1
    assert emails_enviados[0][0] == email
    solicitacao = SolicitacaoRedefinicaoSenha.query.one()
    token = parse_qs(urlparse(emails_enviados[0][1]).fragment)["token"][0]
    assert solicitacao.token_digest != token
    assert len(solicitacao.token_digest) == 64


def testar_solicitacao_nao_revela_se_o_email_existe(
    cliente_teste, monkeypatch
):
    emails_enviados = []
    monkeypatch.setattr(
        "app.services.redefinicao_senha._enviar_email",
        lambda *args: emails_enviados.append(args),
    )
    existente = cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "admin@vitta.com"}
    )
    inexistente = cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "nao-existe@example.com"}
    )

    assert existente.status_code == inexistente.status_code == 202
    assert existente.get_json() == inexistente.get_json()
    assert len(emails_enviados) == 1


def testar_token_redefine_a_senha_e_nao_pode_ser_reutilizado(
    cliente_teste, tokens_teste, monkeypatch
):
    links_enviados = []
    monkeypatch.setattr(
        "app.services.redefinicao_senha._enviar_email",
        lambda _email, link, _nome: links_enviados.append(link),
    )
    solicitacao = cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "admin@vitta.com"}
    )
    cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "admin@vitta.com"}
    )
    token = parse_qs(urlparse(links_enviados[0]).fragment)["token"][0]
    token_anterior = parse_qs(urlparse(links_enviados[1]).fragment)["token"][0]

    assert solicitacao.status_code == 202
    assert cliente_teste.post(
        "/api/v1/auth/password-reset/validate", json={"token": token}
    ).get_json() == {"valid": True}
    redefinicao = cliente_teste.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": token,
            "password": "NovaSenhaSegura123",
            "confirm_password": "NovaSenhaSegura123",
        },
    )

    assert redefinicao.status_code == 200
    assert (
        tokens_teste("admin@vitta.com", "NovaSenhaSegura123")["user"]["email"]
        == "admin@vitta.com"
    )
    assert tokens_teste("medico@vitta.com")["user"]["email"] == "medico@vitta.com"
    assert cliente_teste.post(
        "/api/v1/auth/password-reset/validate", json={"token": token}
    ).get_json() == {"valid": False}
    assert cliente_teste.post(
        "/api/v1/auth/password-reset/validate", json={"token": token_anterior}
    ).get_json() == {"valid": False}
    reutilizado = cliente_teste.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": token,
            "password": "OutraSenhaSegura123",
            "confirm_password": "OutraSenhaSegura123",
        },
    )
    assert reutilizado.status_code == 400


@pytest.mark.parametrize(
    "password,confirmation",
    [
        ("curta1", "curta1"),
        ("SenhaSeguraSemNumero", "SenhaSeguraSemNumero"),
        ("SenhaSegura123", "SenhaDiferente123"),
    ],
)
def testar_redefinicao_rejeita_senhas_inseguras_ou_inconsistentes(
    cliente_teste, monkeypatch, password, confirmation
):
    links_enviados = []
    monkeypatch.setattr(
        "app.services.redefinicao_senha._enviar_email",
        lambda _email, link, _nome: links_enviados.append(link),
    )
    cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "admin@vitta.com"}
    )
    token = parse_qs(urlparse(links_enviados[0]).fragment)["token"][0]
    resposta = cliente_teste.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": token,
            "password": password,
            "confirm_password": confirmation,
        },
    )

    assert resposta.status_code == 400


def testar_limite_de_solicitacoes_aplica_se_tambem_a_emails_inexistentes(
    cliente_teste, app, monkeypatch
):
    app.config["PASSWORD_RESET_EMAIL_LIMIT"] = 1
    monkeypatch.setattr(
        "app.services.redefinicao_senha._enviar_email", lambda *_args: None
    )
    primeiro = cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "fantasma@example.com"}
    )
    segundo = cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "fantasma@example.com"}
    )

    assert primeiro.status_code == 202
    assert segundo.status_code == 429


def testar_token_expirado_nao_pode_redefinir_senha(
    cliente_teste, monkeypatch
):
    links_enviados = []
    monkeypatch.setattr(
        "app.services.redefinicao_senha._enviar_email",
        lambda _email, link, _nome: links_enviados.append(link),
    )
    cliente_teste.post(
        "/api/v1/auth/password-reset", json={"email": "admin@vitta.com"}
    )
    token = parse_qs(urlparse(links_enviados[0]).fragment)["token"][0]
    solicitacao = SolicitacaoRedefinicaoSenha.query.one()
    solicitacao.expires_at = int(time.time()) - 1
    db.session.commit()

    validacao = cliente_teste.post(
        "/api/v1/auth/password-reset/validate", json={"token": token}
    )
    redefinicao = cliente_teste.post(
        "/api/v1/auth/password-reset/confirm",
        json={
            "token": token,
            "password": "NovaSenhaSegura123",
            "confirm_password": "NovaSenhaSegura123",
        },
    )

    assert validacao.get_json() == {"valid": False}
    assert redefinicao.status_code == 400


def testar_logout_revoga_tokens_de_acesso_e_renovacao(cliente_teste, tokens_teste):
    tokens = tokens_teste()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    logout = cliente_teste.post(
        "/api/v1/auth/logout",
        headers=headers,
        json={"refresh_token": tokens["refresh_token"]},
    )

    assert logout.status_code == 200
    assert cliente_teste.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert cliente_teste.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    ).status_code == 401


def testar_conta_de_paciente_somente_acessa_seus_proprios_dados(
    cliente_teste, cabecalho_autenticacao, tokens_teste
):
    def criar_paciente(cpf, name):
        response = cliente_teste.post(
            "/api/v1/patients",
            headers=cabecalho_autenticacao,
            json={
                "name": name,
                "cpf": cpf,
                "birth_date": "1990-01-01",
                "phone": "(11) 90000-0000",
                "email": f"{cpf}@example.com",
            },
        )
        assert response.status_code == 201
        return response.get_json()["patient"]["id"]

    paciente_a = criar_paciente("11111111111", "Paciente A")
    paciente_b = criar_paciente("22222222222", "Paciente B")
    for patient_id, email in (
        (paciente_a, "paciente.a@example.com"),
        (paciente_b, "paciente.b@example.com"),
    ):
        created = cliente_teste.post(
            "/api/v1/users",
            headers=cabecalho_autenticacao,
            json={
                "name": f"Conta {email}",
                "email": email,
                "password": "SenhaPaciente123",
                "confirm_password": "SenhaPaciente123",
                "role": "paciente",
                "patient_id": patient_id,
            },
        )
        assert created.status_code == 201

    login = tokens_teste("paciente.a@example.com", "SenhaPaciente123")
    patient_headers = {"Authorization": f"Bearer {login['access_token']}"}
    own = cliente_teste.get("/api/v1/patients/me", headers=patient_headers)
    appointments = cliente_teste.get(
        "/api/v1/appointments/mine", headers=patient_headers
    )

    assert own.status_code == 200
    assert own.get_json()["patient"]["id"] == paciente_a
    assert appointments.status_code == 200
    assert appointments.get_json()["items"] == []
    assert cliente_teste.get("/api/v1/patients", headers=patient_headers).status_code == 403
    assert cliente_teste.get(
        f"/api/v1/patients/{paciente_b}", headers=patient_headers
    ).status_code == 403
    assert cliente_teste.get("/api/v1/users", headers=patient_headers).status_code == 403
    assert cliente_teste.get("/api/v1/records", headers=patient_headers).status_code == 403


def testar_paciente_nao_pode_ser_vinculado_a_mais_de_uma_conta(
    cliente_teste, cabecalho_autenticacao
):
    patient = cliente_teste.post(
        "/api/v1/patients",
        headers=cabecalho_autenticacao,
        json={
            "name": "Paciente Vinculado",
            "cpf": "33333333333",
            "birth_date": "1990-01-01",
            "phone": "(11) 90000-0000",
        },
    ).get_json()["patient"]
    payload = {
        "name": "Conta Paciente",
        "email": "conta.paciente@example.com",
        "password": "SenhaPaciente123",
        "confirm_password": "SenhaPaciente123",
        "role": "paciente",
        "patient_id": patient["id"],
    }

    first = cliente_teste.post(
        "/api/v1/users", headers=cabecalho_autenticacao, json=payload
    )
    second = cliente_teste.post(
        "/api/v1/users",
        headers=cabecalho_autenticacao,
        json={**payload, "email": "outra.conta@example.com"},
    )

    assert first.status_code == 201
    assert second.status_code == 409


def testar_cadastro_de_usuario_exige_confirmacao_de_senha(
    cliente_teste, cabecalho_autenticacao
):
    response = cliente_teste.post(
        "/api/v1/users",
        headers=cabecalho_autenticacao,
        json={
            "name": "Senha Diferente",
            "email": "senha.diferente@example.com",
            "password": "SenhaInicial123",
            "confirm_password": "SenhaOutra1234",
            "role": "admin",
        },
    )

    assert response.status_code == 400


def testar_administrador_define_e_altera_senha_sem_expor_hash(
    app, cliente_teste, cabecalho_autenticacao
):
    payload = {
        "name": "Conta Editável",
        "email": "conta.editavel@example.com",
        "password": "SenhaInicial123",
        "confirm_password": "SenhaInicial123",
        "role": "admin",
    }
    created = cliente_teste.post(
        "/api/v1/users", headers=cabecalho_autenticacao, json=payload
    )
    user_id = created.get_json()["user"]["id"]
    with app.app_context():
        usuario = db.session.get(Usuario, user_id)
        assert usuario.password_hash != payload["password"]
        assert usuario.verificar_senha(payload["password"])

    updated = cliente_teste.patch(
        f"/api/v1/users/{user_id}",
        headers=cabecalho_autenticacao,
        json={
            "password": "SenhaAlterada123",
            "confirm_password": "SenhaAlterada123",
        },
    )

    assert created.status_code == 201
    assert updated.status_code == 200
    assert "password_hash" not in created.get_json()["user"]
    assert cliente_teste.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "SenhaInicial123"},
    ).status_code == 401
    assert cliente_teste.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "SenhaAlterada123"},
    ).status_code == 200
