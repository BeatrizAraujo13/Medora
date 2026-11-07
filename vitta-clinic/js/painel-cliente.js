/* Exibe apenas os dados e compromissos do paciente autenticado. */
(function () {
  window.VittaModules = window.VittaModules || {};
  window.VittaModules.initCliente = function () {
    const root = document.querySelector("[data-page-content]");
    const patient = window.VittaStorage.all("patients")[0];
    const appointments = window.VittaStorage.all("appointments")
      .slice()
      .sort((left, right) => (right.date + right.time).localeCompare(left.date + left.time));
    const latest = appointments.map((item) => `
      <article class="appointment-row">
        <div class="appointment-time">${window.Vitta.escaparHtml(item.time)}</div>
        <div><strong>${window.Vitta.escaparHtml(window.Vitta.date(item.date))}</strong>
          <small>${window.Vitta.escaparHtml(item.doctor_name || "Médico")}</small></div>
        <span class="status-pill">${window.Vitta.escaparHtml(item.status)}</span>
      </article>`).join("");
    root.innerHTML = `
      <div class="page-heading"><div><h1>Olá, ${window.Vitta.escaparHtml(patient.name.split(" ")[0])} 👋</h1>
      <p>Consulte seus dados e acompanhe suas consultas.</p></div></div>
      <section class="content-card"><div class="card-heading"><h2>Meu cadastro</h2></div>
      <div class="card-body"><p><strong>E-mail:</strong> ${window.Vitta.escaparHtml(patient.email || window.VittaPage.user.email)}</p>
      <p><strong>Telefone:</strong> ${window.Vitta.escaparHtml(patient.phone)}</p></div></section>
      <section class="content-card"><div class="card-heading"><h2>Minhas consultas</h2></div>
      <div class="card-body"><div class="appointment-list">${latest || '<div class="empty-state">Nenhuma consulta cadastrada.</div>'}</div></div></section>`;
  };
})();
