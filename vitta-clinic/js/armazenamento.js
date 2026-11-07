/* Comunicação com a API e cache temporário dos dados exibidos pela interface. */
(function () {
  const SESSION_KEY = "vitta-clinic-session-v1";
  const API_BASE = window.VITTA_API_URL || `${window.location.origin}/api/v1`;
  const colecoes = ["users", "patients", "doctors", "specialties", "appointments", "records"];
  const dados = Object.fromEntries(colecoes.map((colecao) => [colecao, []]));
  let sessao = lerSessao();
  let atualizacaoToken;

  function lerSessao() {
    try {
      const valor = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!valor || !valor.user || !valor.accessToken || !valor.refreshToken) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return valor;
    } catch (error) {
      console.error("Sessão local inválida.", error);
      return null;
    }
  }

  function salvarSessao() {
    if (sessao) localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
    else localStorage.removeItem(SESSION_KEY);
  }

  function traduzirErro(resposta, corpo) {
    const mensagem = corpo && (corpo.error || corpo.message);
    const erro = new Error(mensagem || `A API respondeu com o código ${resposta.status}.`);
    erro.status = resposta.status;
    return erro;
  }

  async function renovarToken() {
    if (!sessao || !sessao.refreshToken) throw new Error("Sua sessão expirou. Entre novamente.");
    if (!atualizacaoToken) {
      atualizacaoToken = fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessao.refreshToken}` }
      }).then(async (resposta) => {
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw traduzirErro(resposta, corpo);
        sessao.accessToken = corpo.access_token;
        salvarSessao();
      }).catch((error) => {
        if (error.status === 401 || error.status === 422) {
          sessao = null;
          salvarSessao();
        }
        throw error;
      }).finally(() => { atualizacaoToken = null; });
    }
    return atualizacaoToken;
  }

  async function requisitar(caminho, opcoes = {}, tentarRenovar = true) {
    const cabecalhos = new Headers(opcoes.headers || {});
    if (opcoes.body && !cabecalhos.has("Content-Type")) cabecalhos.set("Content-Type", "application/json");
    if (sessao && sessao.accessToken && !cabecalhos.has("Authorization")) {
      cabecalhos.set("Authorization", `Bearer ${sessao.accessToken}`);
    }
    let resposta;
    try {
      resposta = await fetch(`${API_BASE}${caminho}`, { ...opcoes, headers: cabecalhos });
    } catch (error) {
      throw new Error(`Não foi possível conectar à API em ${API_BASE}. Confira se o backend está rodando e tente novamente.`);
    }
    if (resposta.status === 401 && tentarRenovar && sessao && sessao.refreshToken && !caminho.endsWith("/auth/refresh")) {
      await renovarToken();
      return requisitar(caminho, opcoes, false);
    }
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw traduzirErro(resposta, corpo);
    return corpo;
  }

  function normalizarPerfil(usuario) {
    const perfis = { admin: "Administrador", medico: "Médico", recepcionista: "Recepcionista", paciente: "Paciente" };
    return {
      id: String(usuario.id),
      name: usuario.name,
      email: usuario.email,
      role: perfis[usuario.role] || usuario.role,
      active: usuario.active !== false,
      doctorId: usuario.doctor_id == null ? null : String(usuario.doctor_id),
      patientId: usuario.patient_id == null ? null : String(usuario.patient_id)
    };
  }

  function normalizarPaciente(paciente) {
    return { ...paciente, id: String(paciente.id), birthDate: paciente.birth_date };
  }

  function normalizarEspecialidade(especialidade) {
    return { ...especialidade, id: String(especialidade.id) };
  }

  function normalizarMedico(medico) {
    return {
      ...medico,
      id: String(medico.id),
      specialtyId: String(medico.specialty_id),
      specialtyName: medico.specialty ? medico.specialty.name : ""
    };
  }

  function normalizarConsulta(consulta) {
    const status = { agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada" };
    return {
      ...consulta,
      id: String(consulta.id),
      patientId: String(consulta.patient_id),
      doctorId: String(consulta.doctor_id),
      specialtyId: consulta.specialty_id == null ? "" : String(consulta.specialty_id),
      status: status[consulta.status] || consulta.status
    };
  }

  function normalizarProntuario(prontuario) {
    return {
      ...prontuario,
      id: String(prontuario.id),
      patientId: String(prontuario.patient_id),
      appointmentId: String(prontuario.appointment_id),
      doctorId: String(prontuario.doctor_id),
      date: prontuario.date
    };
  }

  function colocarNaColecao(colecao, item) {
    const indice = dados[colecao].findIndex((entrada) => entrada.id === item.id);
    if (indice < 0) dados[colecao].unshift(item);
    else dados[colecao][indice] = item;
    window.dispatchEvent(new CustomEvent("vitta:data-changed"));
  }

  function removerDaColecao(colecao, id) {
    dados[colecao] = dados[colecao].filter((item) => item.id !== String(id));
    window.dispatchEvent(new CustomEvent("vitta:data-changed"));
  }

  function identificadorNumerico(id) {
    return /^\d+$/.test(String(id)) ? Number(id) : null;
  }

  function dadosParaApi(colecao, item) {
    if (colecao === "patients") {
      return {
        name: item.name,
        cpf: item.cpf,
        birth_date: item.birthDate,
        phone: item.phone,
        email: item.email || null,
        address: item.address || null,
        insurance: item.insurance || null,
        notes: item.notes || null
      };
    }
    if (colecao === "doctors") {
      return {
        name: item.name,
        crm: item.crm,
        specialty_id: Number(item.specialtyId),
        email: item.email,
        phone: item.phone,
        schedule: item.schedule || null,
        active: item.active !== false
      };
    }
    if (colecao === "specialties") return { name: item.name, description: item.description || null };
    if (colecao === "appointments") {
      const status = { Agendada: "agendada", Realizada: "realizada", Cancelada: "cancelada" };
      return {
        patient_id: Number(item.patientId),
        doctor_id: Number(item.doctorId),
        date: item.date,
        time: item.time,
        status: status[item.status] || item.status,
        notes: item.notes || null
      };
    }
    if (colecao === "records") {
      return {
        appointment_id: Number(item.appointmentId),
        record_date: item.date,
        complaint: item.complaint,
        diagnosis: item.diagnosis,
        prescription: item.prescription || null,
        notes: item.notes || null
      };
    }
    throw new Error(`Não é possível salvar dados da coleção "${colecao}".`);
  }

  const configuracao = {
    patients: { rota: "/patients", recurso: "patient", normalizar: normalizarPaciente },
    doctors: { rota: "/doctors", recurso: "doctor", normalizar: normalizarMedico },
    specialties: { rota: "/specialties", recurso: "specialty", normalizar: normalizarEspecialidade },
    appointments: { rota: "/appointments", recurso: "appointment", normalizar: normalizarConsulta },
    records: { rota: "/records", recurso: "record", normalizar: normalizarProntuario }
  };

  const api = {
    login(email, password) {
      return requisitar("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      }).then((resposta) => {
        sessao = {
          user: normalizarPerfil(resposta.user),
          accessToken: resposta.access_token,
          refreshToken: resposta.refresh_token
        };
        salvarSessao();
        return sessao.user;
      });
    },
    requestPasswordReset(email) {
      return requisitar("/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ email })
      });
    },
    validatePasswordReset(token) {
      return requisitar("/auth/password-reset/validate", {
        method: "POST",
        body: JSON.stringify({ token })
      });
    },
    resetPassword(token, password, confirmPassword) {
      return requisitar("/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password, confirm_password: confirmPassword })
      });
    },
    async verifySession() {
      if (!sessao) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await requisitar("/auth/me");
      sessao.user = normalizarPerfil(response.user);
      salvarSessao();
      return sessao.user;
    },
    async logout() {
      if (!sessao) return;
      await requisitar("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: sessao.refreshToken })
      });
    },
    async createUser(user) {
      const response = await requisitar("/users", {
        method: "POST",
        body: JSON.stringify(user)
      });
      return normalizarPerfil(response.user);
    },
    async updateUser(id, user) {
      const response = await requisitar(`/users/${Number(id)}`, {
        method: "PATCH",
        body: JSON.stringify(user)
      });
      return normalizarPerfil(response.user);
    },
    async listUsers() {
      const response = await requisitar("/users");
      dados.users = response.items.map(normalizarPerfil);
      return dados.users;
    },
    async deleteUser(id) {
      return requisitar(`/users/${Number(id)}`, { method: "DELETE" });
    },
    async initialize() {
      if (!sessao || !sessao.accessToken) return;
      const role = sessao.user.role;
      if (role === "Paciente") {
        const [patientResponse, appointmentResponse] = await Promise.all([
          requisitar("/patients/me"),
          requisitar("/appointments/mine")
        ]);
        dados.patients = [normalizarPaciente(patientResponse.patient)];
        dados.appointments = appointmentResponse.items.map(normalizarConsulta);
        dados.doctors = [];
        dados.specialties = [];
        dados.records = [];
        dados.users = [];
        return dados;
      }
      const requisicoes = [
        requisitar("/patients").then((resposta) => { dados.patients = resposta.items.map(normalizarPaciente); }),
        requisitar("/doctors").then((resposta) => {
          dados.doctors = resposta.items.map(normalizarMedico);
          if (role !== "Administrador") {
            const especialidades = resposta.items.map((item) => item.specialty).filter(Boolean);
            dados.specialties = [...new Map(especialidades.map((item) => [String(item.id), normalizarEspecialidade(item)])).values()];
          }
        }),
        requisitar("/appointments").then((resposta) => { dados.appointments = resposta.items.map(normalizarConsulta); })
      ];
      if (role === "Administrador") {
        requisicoes.push(
          requisitar("/specialties").then((resposta) => { dados.specialties = resposta.items.map(normalizarEspecialidade); }),
          this.listUsers()
        );
      }
      if (role === "Administrador" || role === "Médico") {
        requisicoes.push(requisitar("/records").then((resposta) => { dados.records = resposta.items.map(normalizarProntuario); }));
      } else {
        dados.records = [];
      }
      await Promise.all(requisicoes);
      return dados;
    },
    all(colecao) {
      if (!colecoes.includes(colecao)) throw new Error("Coleção desconhecida: " + colecao);
      return dados[colecao];
    },
    async save(colecao, item) {
      const definicao = configuracao[colecao];
      if (!definicao) throw new Error(`Não é possível salvar dados da coleção "${colecao}".`);
      const id = identificadorNumerico(item.id);
      const resposta = await requisitar(id == null ? definicao.rota : `${definicao.rota}/${id}`, {
        method: id == null ? "POST" : "PATCH",
        body: JSON.stringify(dadosParaApi(colecao, item))
      });
      const salvo = definicao.normalizar(resposta[definicao.recurso]);
      colocarNaColecao(colecao, salvo);
      return salvo;
    },
    async remove(colecao, id) {
      const definicao = configuracao[colecao];
      const identificador = identificadorNumerico(id);
      if (!definicao || identificador == null) throw new Error("O registro selecionado não possui um identificador válido.");
      await requisitar(`${definicao.rota}/${identificador}`, { method: "DELETE" });
      removerDaColecao(colecao, id);
    },
    async report(caminho, parametros = {}) {
      const consulta = new URLSearchParams();
      Object.entries(parametros).forEach(([chave, valor]) => {
        if (valor) consulta.set(chave, valor);
      });
      const sufixo = consulta.size ? `?${consulta.toString()}` : "";
      return requisitar(`${caminho}${sufixo}`);
    },
    session() { return sessao ? sessao.user : null; },
    setSession(user, tokens) {
      sessao = { user, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
      salvarSessao();
    },
    clearSession() {
      sessao = null;
      salvarSessao();
      colecoes.forEach((colecao) => { dados[colecao] = []; });
    },
    newId(prefix) {
      const valor = window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      return prefix + "-" + valor;
    }
  };

  window.VittaStorage = api;
})();
