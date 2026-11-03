/* Operações de médicos e filtro de profissionais por especialidade. */
(function () {
  window.VittaModules = window.VittaModules || {};
  window.VittaModules.initMedicos = function () {
    const writable = window.VittaAuth.can("medicos", "write");
    let specialtyFilter = "";
    const renderizar = () => {
      const card = window.Vitta.tableFrame({
        title: "Médicos",
        description: "Gerencie os profissionais e suas especialidades.",
        searchPlaceholder: "Buscar por nome ou CRM...",
        button: writable ? '<button class="button button-primary" type="button" data-add>＋ Novo médico</button>' : ""
      });
      const specialties = window.VittaStorage.all("specialties");
      const filter = document.createElement("select");
      filter.setAttribute("aria-label", "Filtrar por especialidade");
      filter.innerHTML = `<option value="">Todas especialidades</option>${specialties.map((item) => `<option value="${window.Vitta.escaparHtml(item.id)}">${window.Vitta.escaparHtml(item.name)}</option>`).join("")}`;
      filter.value = specialtyFilter;
      card.querySelector("[data-extra-filters]").appendChild(filter);
      filter.addEventListener("change", () => { specialtyFilter = filter.value; renderizar(); });
      const rows = window.VittaStorage.all("doctors").filter((item) => !specialtyFilter || item.specialtyId === specialtyFilter).map((doctor) => {
        const specialty = specialties.find((item) => item.id === doctor.specialtyId);
        return { ...doctor, specialtyName: specialty ? specialty.name : "Sem especialidade", searchText: `${doctor.name} ${doctor.crm} ${doctor.email || ""} ${specialty ? specialty.name : ""}` };
      });
      window.Vitta.table({
        container: card,
        columns: [
          { label: "Médico", renderizar: (row) => `<span class="table-primary">${window.Vitta.escaparHtml(row.name)}</span><span class="table-secondary">${window.Vitta.escaparHtml(row.crm)}</span>` },
          { label: "Especialidade", renderizar: (row) => window.Vitta.escaparHtml(row.specialtyName) },
          { label: "Contato", renderizar: (row) => `<span>${window.Vitta.escaparHtml(row.email || "—")}</span><span class="table-secondary">${window.Vitta.escaparHtml(row.phone || "")}</span>` },
          { label: "Atendimento", renderizar: (row) => window.Vitta.escaparHtml(row.schedule || "—") }
        ],
        rows,
        actions: writable ? (row) => `<button type="button" class="button button-secondary button-small" data-edit="${window.Vitta.escaparHtml(row.id)}">Editar</button><button type="button" class="button button-danger button-small" data-delete="${window.Vitta.escaparHtml(row.id)}">Excluir</button>` : null
      });
      if (writable) {
        document.querySelector("[data-add]").addEventListener("click", () => editarMedico());
        card.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editarMedico(window.VittaStorage.all("doctors").find((item) => item.id === button.dataset.edit))));
        card.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
          const doctor = window.VittaStorage.all("doctors").find((item) => item.id === button.dataset.delete);
          const linked = window.VittaStorage.all("appointments").some((item) => item.doctorId === doctor.id) || window.VittaStorage.all("records").some((item) => item.doctorId === doctor.id);
          if (linked) { window.Vitta.toast("Não é possível excluir: há consultas ou prontuários vinculados.", "error"); return; }
          window.Vitta.confirm({ title: "Excluir médico?", message: `Deseja excluir ${doctor.name}?`, onConfirm: () => window.VittaStorage.remove("doctors", doctor.id).then(() => { window.Vitta.toast("Médico excluído."); renderizar(); }) });
        }));
      }
    };
    function editarMedico(doctor) {
      if (!window.VittaStorage.all("specialties").length) { window.Vitta.toast("Cadastre uma especialidade antes de incluir médicos.", "error"); return; }
      window.Vitta.modal({
        title: doctor ? "Editar médico" : "Novo médico", values: doctor,
        fields: [
          { name: "name", label: "Nome completo", validation: "name", required: true, full: true },
          { name: "crm", label: "CRM", required: true },
          { name: "specialtyId", label: "Especialidade", type: "select", required: true, options: () => window.VittaStorage.all("specialties").map((item) => ({ value: item.id, label: item.name })) },
          { name: "email", label: "E-mail", type: "email" },
          { name: "phone", label: "Telefone", type: "tel", required: true, placeholder: "(00) 00000-0000" },
          { name: "schedule", label: "Horário de atendimento", placeholder: "Ex.: Seg a sex, 08:00–17:00", full: true }
        ],
        onSubmit: (form) => {
          const duplicate = window.VittaStorage.all("doctors").some((item) => item.crm.toLowerCase() === form.crm.trim().toLowerCase() && item.id !== (doctor && doctor.id));
          if (duplicate) { window.Vitta.toast("Já existe um médico cadastrado com este CRM.", "error"); return false; }
          return window.VittaStorage.save("doctors", { ...(doctor || {}), ...form, name: form.name.trim(), crm: form.crm.trim(), id: doctor ? doctor.id : window.Vitta.id("med") }).then(() => {
            window.Vitta.toast(doctor ? "Cadastro atualizado." : "Médico cadastrado.");
            renderizar();
          });
        }
      });
    }
    renderizar();
  };
})();
