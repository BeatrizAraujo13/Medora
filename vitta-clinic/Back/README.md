# Vitta Clinic API

Backend REST em Flask organizado com fábrica da aplicação, blueprints versionados, modelos SQLAlchemy, esquemas Marshmallow e regras de negócio na camada `services`.

## Requisitos e início rápido (Windows PowerShell)

Requer Python 3.11 ou superior.

```powershell
cd Back
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
notepad .env
```

Cole o valor gerado na linha `DATA_ENCRYPTION_KEY=` do `.env`, salve o arquivo e inicie o projeto:

```powershell
.\.venv\Scripts\python.exe executar.py
```

O script aplica as migrações pendentes, cria dados de demonstração se o banco estiver vazio e inicia o site e a API em `http://127.0.0.1:5000`. A interface e a API usam o mesmo endereço; o health check é `GET /health`. O banco padrão é SQLite em `instance/vitta_clinic.db`.

Para habilitar recuperação de senha, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` e `SMTP_USE_TLS` no `.env`. Configure `PASSWORD_RESET_PUBLIC_URL` com a URL pública da interface (sem barra final); os links expiram em 30 minutos. Sem um SMTP válido, as solicitações são registradas e os erros de envio aparecem no log do servidor, mas nenhum e-mail será entregue.

A recuperação está disponível para todas as contas existentes de administrador, médico e recepcionista. Os cadastros de pacientes ainda não possuem conta de acesso nem senha no sistema.

Mantenha a chave em segredo e guarde uma cópia de segurança separada do banco: sem ela, os campos criptografados não podem ser recuperados. A chave deve permanecer igual entre reinicializações. Faça uma cópia de segurança do banco antes da primeira inicialização com a migração de criptografia, que cifra dados sensíveis já existentes.

Para reinicializar os dados de desenvolvimento, pare o servidor e remova `instance/vitta_clinic.db`; ao iniciar novamente, as migrações serão aplicadas e os dados de demonstração serão criados outra vez. Não reutilize as chaves de `.env.example` em produção.

Os campos pessoais e clínicos cifrados usam AES-256-GCM com nonce aleatório e verificação de integridade. Campos usados em buscas, índices e restrições de unicidade permanecem sem criptografia nesta camada para preservar o comportamento atual.

As páginas internas só exibem o conteúdo depois de validar a sessão com `GET /api/v1/auth/me`; endpoints de dados também verificam o JWT e o perfil no servidor. O logout (`POST /api/v1/auth/logout`) revoga tokens de acesso e renovação. Administradores gerenciam contas em `/pages/usuarios.html`; senhas iniciais e alterações precisam ter de 12 a 72 caracteres, incluir um número e ser confirmadas (limite compatível com bcrypt, medido também em bytes UTF-8). Médicos e recepcionistas são os perfis de funcionário disponíveis. Contas de paciente são vinculadas pelo administrador a um cadastro clínico existente e só podem consultar o próprio cadastro e suas consultas.

Na versão beta, o CPF aceita exatamente 11 dígitos, com ou sem a máscara `000.000.000-00`; os dígitos verificadores oficiais não são validados. O valor continua único e letras ou outras pontuações são rejeitadas.

## Contas de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@vitta.com` | `123456` |
| Médico | `medico@vitta.com` | `123456` |
| Recepcionista | `recepcao@vitta.com` | `123456` |

O seed inclui ainda 3 especialidades, 3 médicos, 5 pacientes, 5 consultas e 1 prontuário.

## Autenticação e cURL

### Login e token

```bash
curl -X POST http://127.0.0.1:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vitta.com","password":"123456"}'
```

Copie o `access_token` da resposta. O token de acesso expira em 30 minutos; use o `refresh_token` no endpoint de renovação. Os exemplos protegidos abaixo usam `TOKEN` como variável de ambiente.

```bash
export TOKEN="cole-o-access-token-aqui"
curl http://127.0.0.1:5000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Para PowerShell, defina `$env:TOKEN = "..."` e use `curl.exe` nos mesmos exemplos.

### Criar paciente

```bash
curl -X POST http://127.0.0.1:5000/api/v1/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Joana Exemplo","cpf":"529.982.247-25","birth_date":"1990-01-10","phone":"(11) 90000-0000","email":"joana@example.com"}'
```

CPF é validado pelos dígitos verificadores e armazenado somente com números.

### Agendar consulta

```bash
curl -X POST http://127.0.0.1:5000/api/v1/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patient_id":1,"doctor_id":2,"date":"2030-05-20","time":"14:30","status":"agendada","notes":"Consulta de rotina"}'
```

### Filtrar agenda e relatórios

```bash
curl "http://127.0.0.1:5000/api/v1/appointments?date_from=2030-05-01&date_to=2030-05-31&status=agendada" \
  -H "Authorization: Bearer $TOKEN"
curl "http://127.0.0.1:5000/api/v1/reports/appointments?date_from=2030-05-01&date_to=2030-05-31" \
  -H "Authorization: Bearer $TOKEN"
```

### Criar prontuário

O médico ou administrador marca primeiro a consulta como realizada; prontuários exigem consulta realizada e só pode existir um por consulta.

```bash
curl -X PATCH http://127.0.0.1:5000/api/v1/appointments/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"realizada"}'
curl -X POST http://127.0.0.1:5000/api/v1/records \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appointment_id":1,"record_date":"2030-05-20","complaint":"Retorno","diagnosis":"Estável","prescription":"Acompanhamento"}'
```

## Endpoints

Todos os endpoints de negócio ficam em `/api/v1`. Login é público; as demais rotas exigem JWT, exceto `POST /auth/register`, que exige token de administrador.

| Recurso | Rotas |
| --- | --- |
| Autenticação | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/register` |
| Recuperação de senha | `POST /auth/password-reset`, `POST /auth/password-reset/validate`, `POST /auth/password-reset/confirm` |
| Usuários (admin) | `GET/POST /users`, `GET/PATCH/DELETE /users/{id}` |
| Pacientes | `GET/POST /patients`, `GET/PATCH/DELETE /patients/{id}` |
| Médicos | `GET/POST /doctors`, `GET/PATCH/DELETE /doctors/{id}` |
| Especialidades (admin) | `GET/POST /specialties`, `GET/PATCH/DELETE /specialties/{id}` |
| Consultas | `GET/POST /appointments`, `GET/PATCH/DELETE /appointments/{id}` |
| Prontuários (admin/médico) | `GET/POST /records`, `GET/PATCH/DELETE /records/{id}` |
| Relatórios (admin) | `GET /reports/appointments`, `GET /reports/patients`, `GET /reports/doctors` |

Listagens aceitam filtros: pacientes `search`; médicos `search` e `specialty_id`; consultas `date_from`, `date_to`, `status` e `doctor_id`; prontuários `patient_id`. Administradores podem usar `include_deleted=true` em pacientes.

## Regras e perfis

- Perfis disponíveis: `admin`, `medico`, `recepcionista`; os três usuários de seed usam senha `123456`.
- Usuários, especialidades e relatórios são exclusivos de administradores. `POST /auth/register` também requer administrador.
- A solicitação de recuperação sempre responde de forma genérica, os tokens são armazenados apenas como hash, expiram em 30 minutos e são invalidados após o uso. A senha redefinida deve ter de 12 a 72 caracteres, incluir um número e ocupar no máximo 72 bytes UTF-8. Os limites padrão são 3 solicitações por e-mail e 10 por endereço IP por hora.
- Médicos consultam sua própria agenda e prontuários e podem marcar suas consultas como realizadas; recepcionistas agendam consultas e mantêm pacientes.
- CPF (dígitos verificadores) e CRM (UF + número) são validados e únicos.
- Consultas agendadas não podem ficar no passado nem colidir para o mesmo médico ou paciente no mesmo horário. Horários cancelados podem ser reutilizados.
- Prontuários são restritos a médico/admin, só podem ser gravados em consultas realizadas e são únicos por consulta.
- Pacientes com histórico são desativados por soft delete; sem histórico, a linha é removida.
- Respostas de erro seguem JSON `{ "error": "...", "details": ... }`.

## Testes

```powershell
# Execute dentro da pasta Back
python -m pytest -q
```

Também é possível executar o comando da raiz de `vitta-clinic` com `python -m pytest Back\tests -q`. A configuração do pytest inclui a pasta `Back` no caminho de importação da aplicação. Os testes usam SQLite em memória e cobrem autenticação/perfis, CPF, soft delete, datas e conflitos da agenda, e as regras de prontuário. Para aplicar alterações de modelo após o início do projeto, execute `flask --app executar.py db migrate -m "Descrição"` e `flask --app executar.py db upgrade`.

## Estrutura de pastas

```text
Back/
├── app/
│   ├── models/       # Entidades e relacionamentos SQLAlchemy
│   │   ├── consulta.py
│   │   ├── especialidade.py
│   │   ├── medico.py
│   │   ├── paciente.py
│   │   ├── prontuario.py
│   │   └── usuario.py
│   ├── routes/       # Blueprints REST /api/v1
│   │   ├── autenticacao.py
│   │   ├── consultas.py
│   │   ├── especialidades.py
│   │   ├── medicos.py
│   │   ├── pacientes.py
│   │   ├── prontuarios.py
│   │   ├── relatorios.py
│   │   └── usuarios.py
│   ├── schemas/      # Validação e parsing Marshmallow
│   ├── services/     # Regras de negócio e persistência
│   ├── utils/        # JWT, validações e erros HTTP
│   ├── configuracao.py
│   ├── dados_iniciais.py
│   └── extensoes.py
├── migrations/     # Migração inicial versionada (Flask-Migrate/Alembic)
├── tests/
├── .env.example
├── requirements.txt
└── executar.py
```

Este backend é uma base demonstrativa. Para produção, use segredos exclusivos, HTTPS, controle de acesso operacional, backups, logs de auditoria e políticas de privacidade compatíveis com dados de saúde.
