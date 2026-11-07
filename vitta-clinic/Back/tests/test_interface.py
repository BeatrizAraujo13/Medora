def test_aplicacao_serve_site_e_recursos_estaticos(cliente_teste):
    inicio = cliente_teste.get("/")
    estilo = cliente_teste.get("/css/normalizacao.css")
    script = cliente_teste.get("/js/armazenamento.js")

    assert inicio.status_code == 200
    assert b'<html lang="pt-BR">' in inicio.data
    assert estilo.status_code == 200
    assert script.status_code == 200
    assert b"/api/v1" in script.data


def test_aplicacao_serve_telas_de_recuperacao(cliente_teste):
    recuperar = cliente_teste.get("/recuperar-senha.html")
    redefinir = cliente_teste.get("/redefinir-senha.html")
    login = cliente_teste.get("/")

    assert recuperar.status_code == redefinir.status_code == 200
    assert b"Esqueci minha senha" in login.data
    assert b"request-reset-form" in recuperar.data
    assert b"reset-password-form" in redefinir.data


def test_paginas_internas_ficam_ocultas_ate_validar_sessao(cliente_teste):
    dashboard = cliente_teste.get("/pages/dashboard.html")
    users = cliente_teste.get("/pages/usuarios.html")
    cliente = cliente_teste.get("/pages/cliente.html")

    assert dashboard.status_code == users.status_code == cliente.status_code == 200
    assert b'class="protected-page"' in dashboard.data
    assert b'class="protected-page"' in users.data
    assert b'class="protected-page"' in cliente.data
    assert cliente_teste.get("/admin").headers["Location"].endswith(
        "/pages/dashboard.html?area=admin"
    )
    assert cliente_teste.get("/funcionario").headers["Location"].endswith(
        "/pages/dashboard.html?area=funcionario"
    )
    assert cliente_teste.get("/cliente").headers["Location"].endswith(
        "/pages/cliente.html?area=cliente"
    )


def test_tela_de_usuarios_carrega_o_modulo_de_cadastro(cliente_teste):
    pagina = cliente_teste.get("/pages/usuarios.html")
    modulo = cliente_teste.get("/js/usuarios.js")

    assert pagina.status_code == modulo.status_code == 200
    assert b"../js/usuarios.js" in pagina.data
    assert b"Novo usu" in modulo.data
    assert b"createUser(payload)" in modulo.data


def test_rota_api_inexistente_nao_serve_arquivo_estatico(cliente_teste):
    resposta = cliente_teste.get("/api/v1/rota-inexistente")

    assert resposta.status_code == 404
