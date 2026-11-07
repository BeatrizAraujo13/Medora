"""Fábrica da aplicação Flask para a API Vitta Clinic."""

import os
from pathlib import Path

import click
from flask import Flask, abort, redirect, send_from_directory

from app.configuracao import Configuracao
from app.extensoes import bcrypt, cors, db, jwt, migrate
from app.utils.criptografia import decodificar_chave
from app.utils.erros import registrar_tratadores_de_erro


def criar_aplicacao(config_object=Configuracao):
    app = Flask(__name__)
    app.config.from_object(config_object)
    app.config["CHAVE_CIFRAGEM"] = decodificar_chave(app.config.get("DATA_ENCRYPTION_KEY"))
    os.makedirs(app.instance_path, exist_ok=True)
    diretorio_frontend = Path(__file__).resolve().parents[2]

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=False,
    )
    registrar_tratadores_de_erro(app)

    from app import models  # noqa: F401
    from app.models import TokenRevogado
    from app.routes import api_v1

    app.register_blueprint(api_v1)

    @app.get("/")
    def pagina_inicial():
        return send_from_directory(diretorio_frontend, "index.html")

    @app.get("/admin")
    def area_administrativa():
        return redirect("/pages/dashboard.html?area=admin")

    @app.get("/funcionario")
    def area_funcionario():
        return redirect("/pages/dashboard.html?area=funcionario")

    @app.get("/cliente")
    def area_cliente():
        return redirect("/pages/cliente.html?area=cliente")


    @app.get("/<path:caminho>")
    def arquivo_frontend(caminho):
        if caminho == "api" or caminho.startswith("api/"):
            abort(404)
        return send_from_directory(diretorio_frontend, caminho)

    @app.get("/health")
    def verificar_saude():
        return {"status": "ok", "service": "vitta-clinic-api"}

    @app.cli.command("seed")
    def comando_popular_banco():
        """Cria os dados iniciais de desenvolvimento (as tabelas são criadas se necessário)."""
        db.create_all()
        from app.dados_iniciais import popular_banco

        if popular_banco():
            click.echo("Dados de demonstração criados.")
        else:
            click.echo("O banco já possui usuários; seed não alterou os dados.")

    @jwt.unauthorized_loader
    def token_ausente(_reason):
        return {"error": "Token JWT obrigatório."}, 401

    @jwt.token_in_blocklist_loader
    def token_revogado(_header, payload):
        return db.session.get(TokenRevogado, payload["jti"]) is not None

    @jwt.invalid_token_loader
    def token_invalido(_reason):
        return {"error": "Token JWT inválido."}, 401

    @jwt.expired_token_loader
    def token_expirado(_header, _payload):
        return {"error": "Token JWT expirado."}, 401

    @jwt.needs_fresh_token_loader
    def token_recente_obrigatorio(_header, _payload):
        return {"error": "É necessário um token JWT atualizado."}, 401

    return app
