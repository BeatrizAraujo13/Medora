/* Acesso, sessão persistente e regras simples de permissão por perfil. */
(function () {
  const permissions = {
    Administrador: { dashboard: "read", pacientes: "write", medicos: "write", especialidades: "write", consultas: "write", prontuarios: "write", relatorios: "read", usuarios: "write" },
    Médico: { dashboard: "read", pacientes: "read", medicos: "read", consultas: "read", prontuarios: "write" },
    Recepcionista: { dashboard: "read", pacientes: "write", medicos: "read", especialidades: "read", consultas: "write" },
    Paciente: { cliente: "read" }
  };
  const destination = (user) => {
    if (user && user.role === "Paciente") return "/pages/cliente.html";
    return "/pages/dashboard.html";
  };
  const api = {
    current() { return window.VittaStorage.session(); },
    can(page, action) {
      const user = this.current();
      const permission = user && permissions[user.role] && permissions[user.role][page];
      return action === "read" ? Boolean(permission) : permission === "write";
    },
    async logout() {
      let falhaAoRevogar = false;
      try {
        await window.VittaStorage.logout();
      } catch (error) {
        console.error("Não foi possível revogar a sessão no servidor.", error);
        falhaAoRevogar = true;
      } finally {
        window.VittaStorage.clearSession();
      }
      window.location.href = falhaAoRevogar
        ? "/?logout_error=1"
        : (window.location.pathname.includes("/pages/") ? "../index.html" : "index.html");
    }
  };
  api.destination = destination;
  window.VittaAuth = api;

  const form = document.getElementById("login-form");
  if (!form) return;
  if (new URLSearchParams(window.location.search).has("logout_error")) {
    document.getElementById("login-error").textContent =
      "A sessão local foi encerrada, mas não foi possível confirmar a revogação no servidor.";
    window.history.replaceState(null, "", window.location.pathname);
  }
  if (api.current()) {
    window.VittaStorage.verifySession().then((user) => {
      window.location.replace(destination(user));
    }).catch(() => window.VittaStorage.clearSession());
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = document.getElementById("login-error");
    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const user = await window.VittaStorage.login(email, password);
      window.location.href = destination(user);
    } catch (failure) {
      error.textContent = failure.message || "Não foi possível entrar. Confira os dados e tente novamente.";
      form.elements.password.setAttribute("aria-invalid", "true");
    } finally {
      submit.disabled = false;
    }
  });
  form.addEventListener("input", () => {
    const error = document.getElementById("login-error");
    error.textContent = "";
    form.elements.password.removeAttribute("aria-invalid");
  });
})();
