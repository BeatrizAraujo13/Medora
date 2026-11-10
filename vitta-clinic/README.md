# Vitta Clinic

Sistema de gestão de clínica com interface em HTML, CSS e JavaScript e API REST em Flask. Um único comando inicia o site e a API juntos.

## Como executar

Abra o PowerShell na pasta `vitta-clinic`. Na primeira execução, entre em `Back`, crie o ambiente e instale as dependências:

```powershell
cd Back
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Depois, na mesma pasta `Back`, inicie tudo com:

```powershell
.\.venv\Scripts\python.exe executar.py
```

O próprio `executar.py` aplica as migrações, cria os dados iniciais se necessário e inicia o site e a API juntos. Abra `http://127.0.0.1:5000` no navegador e mantenha o terminal aberto.

### Credenciais de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@vitta.com` | `Teste02468@@` |
| Médico | `medico@vitta.com` | `Medico02468@@` |
| Recepcionista | `recepcao@vitta.com` | `123456` |
| Paciente | 'paciente@vitta.com' | 'Paciente02468@@'

Use o botão **Sair** para encerrar a sessão. Os dados da clínica ficam no banco SQLite do backend; a sessão de acesso fica no armazenamento local do navegador.

## Funcionalidades

- Sessão persistente, login e navegação conforme o perfil.
- Dashboard com indicadores, próximas consultas e gráfico mensal.
- Cadastro, edição, busca, paginação e exclusão confirmada de pacientes, médicos, especialidades e consultas.
- Validação de CPF e CRM, prevenção de duplicidades e validação de datas de agendamento.
- Prontuários vinculados a paciente e consulta, com histórico cronológico; gravação disponível para médicos e administradores.
- Relatórios de consultas por período, consultas por médico e pacientes cadastrados, com impressão.
- Layout responsivo, etiquetas acessíveis, estados vazios e notificações.

## Estrutura

```text
vitta-clinic/
├── index.html
├── Back/        # API Flask (instruções em Back/README.md)
├── pages/       # Dashboard e módulos da aplicação
├── css/         # Normalização, variáveis, estilos compartilhados e responsividade
├── js/          # Acesso à API, autenticação, utilitários e módulos
├── assets/      # Logo e recursos visuais
└── data/        # Exemplo de estrutura do banco (banco.json)
```

Mais detalhes de instalação, contas e rotas estão em [Back/README.md](./Back/README.md).

## Observação de segurança

Esta aplicação é demonstrativa. As credenciais listadas são públicas e destinam-se somente ao banco de teste; não utilize dados pessoais ou informações clínicas reais. Um sistema de produção requer segredos exclusivos, HTTPS, controles de acesso, auditoria, backups e conformidade com a legislação aplicável.
