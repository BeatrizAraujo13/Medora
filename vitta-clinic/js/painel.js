/* Indicadores operacionais, agenda futura e gráfico mensal do painel. */
(function () {
  window.VittaModules = window.VittaModules || {};
  window.VittaModules.initDashboard = function () {
    const root = document.querySelector("[data-page-content]");
    const today = window.Vitta.today();
    const doctorId = window.VittaPage.user.doctorId;
    const appointments = window.VittaStorage.all("appointments")
      .filter((item) => !doctorId || String(item.doctorId) === String(doctorId));
    const doctors = window.VittaStorage.all("doctors");
    const specialties = window.VittaStorage.all("specialties");
    const todayCount = appointments.filter((item) => item.date === today && item.status !== "Cancelada").length;
    const weekDate = new Date();
    weekDate.setDate(weekDate.getDate() + 7);
    const weekEnd = window.Vitta.chaveData(weekDate);
    const weekCount = appointments.filter((item) => item.date >= today && item.date <= weekEnd && item.status === "Agendada").length;
    let chartRange = 6;
    let selectedMonth = "";
    let hoveredMonth = "";
    let focusedMonth = "";
    let appointmentFilter = "upcoming";
    const defaultChartSummary = "Passe o mouse sobre um mês para ver a quantidade de consultas.";

    root.innerHTML = `<div class="page-heading"><div><h1>Olá, ${window.Vitta.escaparHtml(window.VittaPage.user.name.split(" ")[0])} 👋</h1><p>Acompanhe os indicadores e a agenda da clínica.</p></div><span class="status-pill">${window.Vitta.escaparHtml(today.split("-").reverse().join("/"))}</span></div>
      <section class="stat-grid" aria-label="Indicadores">
        <a class="stat-card stat-card-link" href="consultas.html"><div class="stat-card-top"><span>Consultas hoje</span><span class="stat-icon" aria-hidden="true">▣</span></div><div class="stat-value">${todayCount}</div><div class="stat-foot">Agendadas para hoje · Abrir agenda →</div></a>
        <a class="stat-card stat-card-link" href="pacientes.html"><div class="stat-card-top"><span>Pacientes cadastrados</span><span class="stat-icon" aria-hidden="true">♡</span></div><div class="stat-value">${window.VittaStorage.all("patients").length}</div><div class="stat-foot">Base de pacientes · Ver pacientes →</div></a>
        <a class="stat-card stat-card-link" href="medicos.html"><div class="stat-card-top"><span>Médicos ativos</span><span class="stat-icon" aria-hidden="true">✚</span></div><div class="stat-value">${doctors.length}</div><div class="stat-foot">Profissionais cadastrados · Ver equipe →</div></a>
        <a class="stat-card stat-card-link" href="consultas.html"><div class="stat-card-top"><span>Próximos 7 dias</span><span class="stat-icon" aria-hidden="true">◷</span></div><div class="stat-value">${weekCount}</div><div class="stat-foot">Consultas agendadas · Abrir agenda →</div></a>
      </section>
      <div class="dashboard-grid">
        <section class="chart-card" aria-labelledby="dashboard-chart-title">
          <div class="card-heading dashboard-chart-heading"><h2 id="dashboard-chart-title">Consultas por mês</h2><div class="dashboard-controls" role="group" aria-label="Período do gráfico">
            <button type="button" class="dashboard-filter" data-chart-range="3" aria-pressed="false">3 meses</button>
            <button type="button" class="dashboard-filter" data-chart-range="6" aria-pressed="true">6 meses</button>
            <button type="button" class="dashboard-filter" data-chart-range="12" aria-pressed="false">12 meses</button>
          </div></div>
          <div class="card-body"><div class="chart-scroll"><div class="chart-bars" data-chart-bars></div></div><p class="chart-summary" data-chart-summary aria-live="polite">${defaultChartSummary}</p></div>
        </section>
        <section class="content-card" aria-labelledby="dashboard-appointments-title">
          <div class="card-heading dashboard-agenda-heading"><div><h2 id="dashboard-appointments-title">Agenda</h2><a class="muted" href="consultas.html">Ver agenda completa →</a></div>
            <div class="dashboard-controls" role="group" aria-label="Filtrar consultas">
              <button type="button" class="dashboard-filter" data-appointment-filter="upcoming" aria-pressed="true">Próximas</button>
              <button type="button" class="dashboard-filter" data-appointment-filter="today" aria-pressed="false">Hoje</button>
              <button type="button" class="dashboard-filter" data-appointment-filter="week" aria-pressed="false">7 dias</button>
            </div>
          </div><div class="card-body"><div class="appointment-list" data-appointment-list></div></div>
        </section>
      </div>`;

    function renderChart() {
      const months = [];
      for (let offset = chartRange - 1; offset >= 0; offset--) {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - offset);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const inMonth = appointments.filter((item) => item.date.slice(0, 7) === key);
        months.push({
          key,
          label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          count: inMonth.length
        });
      }

      const maximum = Math.max(1, ...months.map((item) => item.count));
      const chart = root.querySelector("[data-chart-bars]");
      chart.style.setProperty("--chart-columns", months.length);
      chart.innerHTML = months.map((item) => {
        const details = `${item.count} ${item.count === 1 ? "consulta" : "consultas"} em ${item.label} de ${item.key.slice(0, 4)}`;
        return `<button type="button" class="chart-column${selectedMonth === item.key ? " selected" : ""}" data-month="${item.key}" aria-pressed="${selectedMonth === item.key}" aria-label="${window.Vitta.escaparHtml(details)}" title="${window.Vitta.escaparHtml(details)}">
          <span class="chart-bar" style="height:${Math.max(4, item.count / maximum * 82)}%"><span>${item.count}</span></span><span>${window.Vitta.escaparHtml(item.label)}</span>
        </button>`;
      }).join("");

      const summary = root.querySelector("[data-chart-summary]");
      const updateSummary = () => {
        const key = hoveredMonth || focusedMonth || selectedMonth;
        const month = months.find((item) => item.key === key);
        summary.textContent = month
          ? `${month.count} ${month.count === 1 ? "consulta" : "consultas"} em ${month.label} de ${month.key.slice(0, 4)}.`
          : defaultChartSummary;
      };

      chart.querySelectorAll("[data-month]").forEach((button) => {
        button.addEventListener("pointerenter", () => { hoveredMonth = button.dataset.month; updateSummary(); });
        button.addEventListener("pointerleave", () => { hoveredMonth = ""; updateSummary(); });
        button.addEventListener("focus", () => { focusedMonth = button.dataset.month; updateSummary(); });
        button.addEventListener("blur", () => { focusedMonth = ""; updateSummary(); });
        button.addEventListener("click", () => {
          selectedMonth = selectedMonth === button.dataset.month ? "" : button.dataset.month;
          updateSummary();
          renderChart();
        });
      });

      root.querySelectorAll("[data-chart-range]").forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.chartRange) === chartRange));
      });
    }

    function renderAppointments() {
      let filtered;
      if (appointmentFilter === "today") {
        filtered = appointments.filter((item) => item.date === today && item.status !== "Cancelada");
      } else if (appointmentFilter === "week") {
        filtered = appointments.filter((item) => item.date >= today && item.date <= weekEnd && item.status === "Agendada");
      } else {
        filtered = appointments.filter((item) => item.date >= today && item.status === "Agendada");
      }
      filtered.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const rows = filtered.slice(0, 5).map((item) => {
        const names = window.Vitta.appointmentName(item);
        const doctor = doctors.find((entry) => String(entry.id) === String(item.doctorId));
        const specialty = doctor && specialties.find((entry) => String(entry.id) === String(doctor.specialtyId));
        return `<div class="appointment-row"><div class="appointment-time">${window.Vitta.escaparHtml(item.time)}</div><div><strong>${window.Vitta.escaparHtml(names.patient)}</strong><small>${window.Vitta.escaparHtml(names.doctor)} · ${window.Vitta.date(item.date)}</small></div><span class="status-pill">${window.Vitta.escaparHtml(specialty ? specialty.name : "")}</span></div>`;
      }).join("");
      root.querySelector("[data-appointment-list]").innerHTML = rows || '<div class="empty-state">Nenhuma consulta encontrada para este período.</div>';
      root.querySelectorAll("[data-appointment-filter]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.appointmentFilter === appointmentFilter));
      });
    }

    root.querySelectorAll("[data-chart-range]").forEach((button) => button.addEventListener("click", () => {
      chartRange = Number(button.dataset.chartRange);
      selectedMonth = "";
      hoveredMonth = "";
      focusedMonth = "";
      root.querySelector("[data-chart-summary]").textContent = defaultChartSummary;
      renderChart();
    }));
    root.querySelectorAll("[data-appointment-filter]").forEach((button) => button.addEventListener("click", () => {
      appointmentFilter = button.dataset.appointmentFilter;
      renderAppointments();
    }));
    renderChart();
    renderAppointments();
  };
})();
