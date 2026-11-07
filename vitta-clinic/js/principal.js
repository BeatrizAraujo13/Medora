/* Inicializa o layout comum, a navegação, o perfil e a proteção das páginas. */
(function () {
  const pages = [
    ["dashboard", "Dashboard", "◫"], ["cliente", "Minha área", "♡"], ["pacientes", "Pacientes", "♡"], ["medicos", "Médicos", "✚"],
    ["especialidades", "Especialidades", "✳"], ["consultas", "Consultas", "▣"], ["prontuarios", "Prontuários", "▤"], ["relatorios", "Relatórios", "▥"], ["usuarios", "Usuários", "♙"]
  ];
  const titles = { dashboard: "Visão geral", cliente: "Área do paciente", pacientes: "Pacientes", medicos: "Médicos", consultas: "Consultas", prontuarios: "Prontuários eletrônicos", especialidades: "Especialidades", relatorios: "Relatórios", usuarios: "Usuários" };
  const path = window.location.pathname.split("/").pop().replace(".html", "");
  const expectedArea = new URLSearchParams(window.location.search).get("area");
  const root = document.getElementById("app-root");
  document.body.classList.add("protected-page");
  const retornarAoPainel = (user) => {
    window.location.replace(user ? window.VittaAuth.destination(user) : "../index.html");
  };
  window.VittaStorage.verifySession().then(async (user) => {
    const areaPermitida = !expectedArea
      || (expectedArea === "admin" && user.role === "Administrador")
      || (expectedArea === "funcionario" && ["Médico", "Recepcionista"].includes(user.role))
      || (expectedArea === "cliente" && user.role === "Paciente");
    if (!areaPermitida) {
      retornarAoPainel(user);
      return;
    }
    if (!window.VittaAuth.can(path, "read")) {
      retornarAoPainel(user);
      return;
    }
    window.VittaPage = { path, user };
    await window.VittaStorage.initialize();
    const nav = pages.filter(([id]) => window.VittaAuth.can(id, "read")).map(([id, label, icon]) =>
      `<a href="${id}.html" aria-label="${label}" class="${id === path ? "active" : ""}" ${id === path ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join("");
    const paginaInicial = user.role === "Paciente" ? "cliente.html" : "dashboard.html";
    root.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="sidebar-brand" href="${paginaInicial}" aria-label="Medora"><img src="../assets/images/logo.png" alt=""><span>Medora</span></a><nav class="sidebar-nav" aria-label="Navegação principal">${nav}<a href="#" data-logout aria-label="Sair"><span class="nav-icon" aria-hidden="true">↪</span><span>Sair</span></a></nav><div class="sidebar-bottom">Cuidado que conecta<br>© Vitta Clinic</div></aside><div class="main-area"><header class="topbar"><div class="topbar-title">${titles[path] || "Vitta Clinic"}</div><div class="user-menu"><div class="user-avatar" aria-hidden="true">${window.Vitta.escaparHtml(user.name.charAt(0))}</div><div class="user-info"><strong>${window.Vitta.escaparHtml(user.name)}</strong><span>${window.Vitta.escaparHtml(user.role)}</span></div><button class="button button-secondary button-small" type="button" data-logout>Sair</button></div></header><main class="page-content" data-page-content></main></div></div>`;
    document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); window.VittaAuth.logout(); }));
    const moduleName = "init" + path.charAt(0).toUpperCase() + path.slice(1);
    if (window.VittaModules && typeof window.VittaModules[moduleName] === "function") window.VittaModules[moduleName]();
    document.body.classList.remove("protected-page");
    window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      window.VittaStorage.verifySession().then((currentUser) => {
        if (currentUser.id !== user.id || currentUser.role !== user.role) {
          window.location.replace(window.VittaAuth.destination(currentUser));
        }
      }).catch(() => {
        if (!window.VittaStorage.session()) window.location.replace("../index.html");
      });
    }, 60_000);
  }).catch((error) => {
    if (!window.VittaStorage.session()) {
      window.location.replace("../index.html");
      return;
    }
    root.replaceChildren();
    const message = document.createElement("p");
    message.className = "form-error";
    message.setAttribute("role", "alert");
    message.textContent = `Não foi possível confirmar a sessão ou carregar os dados: ${error.message}`;
    const retry = document.createElement("button");
    retry.className = "button button-primary";
    retry.type = "button";
    retry.textContent = "Tentar novamente";
    retry.addEventListener("click", () => window.location.reload());
    root.append(message, retry);
    document.body.classList.remove("protected-page");
  });
})();
