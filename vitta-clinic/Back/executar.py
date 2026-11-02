"""Ponto de entrada que prepara o banco e inicia o site com a API."""

from pathlib import Path

from dotenv import load_dotenv
from flask_migrate import upgrade

load_dotenv(Path(__file__).resolve().parent / ".env")

from app import criar_aplicacao
from app.dados_iniciais import popular_banco

app = criar_aplicacao()


if __name__ == "__main__":
    diretorio_migracoes = Path(__file__).resolve().parent / "migrations"
    with app.app_context():
        upgrade(directory=str(diretorio_migracoes))
        popular_banco()
    print("Medora disponível em http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
