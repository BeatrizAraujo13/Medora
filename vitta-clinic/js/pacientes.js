/* Operações de pacientes com busca, validação de CPF e prevenção de duplicidades. */
(function () {
  window.VittaModules = window.VittaModules || {};
  window.VittaModules.initPacientes = function () {
    const writable = window.VittaAuth.can("pacientes", "write");
    const renderizar = () => {
      const card = window.Vitta.tableFrame({
        title: "Pacientes",
        description: "Consulte e mantenha os dados dos pacientes da clínica.",
        searchPlaceholder: "Buscar por nome ou CPF...",
        button: writable ? '<button class="button button-primary" type="button" data-add>＋ Novo paciente</button>' : ""
      });
      const rows = window.VittaStorage.all("patients").map((patient) => ({
        ...patient,
        searchText: `${patient.name} ${patient.cpf} ${patient.email || ""}`
      }));
      window.Vitta.table({
        container: card,
        columns: [
          { label: "Paciente", renderizar: (row) => `<span class="table-primary">${window.Vitta.escaparHtml(row.name)}</span><span class="table-secondary">${window.Vitta.escaparHtml(row.email || "Sem e-mail")}</span>` },
          { label: "CPF", renderizar: (row) => window.Vitta.escaparHtml(window.Vitta.cpfFormat(row.cpf)) },
          { label: "Telefone", renderizar: (row) => window.Vitta.escaparHtml(row.phone || "—") },
          { label: "Convênio", renderizar: (row) => window.Vitta.escaparHtml(row.insurance || "—") }
        ],
        rows,
        actions: writable ? (row) => `<button type="button" class="button button-secondary button-small" data-edit="${window.Vitta.escaparHtml(row.id)}">Editar</button><button type="button" class="button button-danger button-small" data-delete="${window.Vitta.escaparHtml(row.id)}">Excluir</button>` : null
      });
      if (writable) {
        document.querySelector("[data-add]").addEventListener("click", () => editarPaciente());
        card.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editarPaciente(window.VittaStorage.all("patients").find((item) => item.id === button.dataset.edit))));
        card.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
          const patient = window.VittaStorage.all("patients").find((item) => item.id === button.dataset.delete);
          const linked = window.VittaStorage.all("appointments").some((item) => item.patientId === patient.id) || window.VittaStorage.all("records").some((item) => item.patientId === patient.id);
          if (linked) {
            window.Vitta.confirm({ title: "Excluir paciente?", message: `O paciente ${patient.name} possui consultas ou prontuários vinculados. Excluir ainda assim poderá deixar esses registros sem vínculo.`, onConfirm: () => removerPaciente(patient.id) });
          } else window.Vitta.confirm({ title: "Excluir paciente?", message: `Deseja excluir ${patient.name}? Esta ação não pode ser desfeita.`, onConfirm: () => removerPaciente(patient.id) });
        }));
      }
    };
    function removerPaciente(id) {
      return window.VittaStorage.remove("patients", id).then(() => {
        window.Vitta.toast("Paciente excluído com sucesso.");
        renderizar();
      });
    }
    function editarPaciente(patient) {
      const editing = Boolean(patient);
      window.Vitta.modal({
        title: editing ? "Editar paciente" : "Novo paciente",
        values: patient ? { ...patient, cpf: window.Vitta.cpfFormat(patient.cpf) } : undefined,
        fields: [
          { name: "name", label: "Nome completo", validation: "name", required: true, full: true },
          { name: "cpf", label: "CPF", required: true, placeholder: "000.000.000-00", maxLength: 14 },
          { name: "birthDate", label: "Data de nascimento", type: "date", max: window.Vitta.today(), required: true },
          { name: "phone", label: "Telefone", type: "tel", required: true, placeholder: "(00) 00000-0000" },
          { name: "email", label: "E-mail", type: "email" },
          { name: "insurance", label: "Convênio" },
          { name: "address", label: "Endereço", validation: "address", full: true },
          { name: "notes", label: "Observações", type: "textarea", full: true }
        ],
        onSubmit: (form) => {
          const cpf = window.Vitta.cpfFormat(form.cpf);
          if (!window.Vitta.cpfValid(cpf)) {
            window.Vitta.toast("Informe exatamente 11 números para o CPF.", "error");
            return false;
          }
          const duplicate = window.VittaStorage.all("patients").some((item) => item.cpf.replace(/\D/g, "") === cpf.replace(/\D/g, "") && item.id !== (patient && patient.id));
          if (duplicate) { window.Vitta.toast("Já existe um paciente cadastrado com este CPF.", "error"); return false; }
          if (form.birthDate > window.Vitta.today()) { window.Vitta.toast("A data de nascimento deve ser hoje ou anterior.", "error"); return false; }
          return window.VittaStorage.save("patients", { ...(patient || {}), ...form, cpf, id: patient ? patient.id : window.Vitta.id("pac") }).then(() => {
            window.Vitta.toast(editing ? "Cadastro atualizado." : "Paciente cadastrado.");
            renderizar();
          });
        }
      });
      const cpfInput = document.getElementById("field-cpf");
      cpfInput.addEventListener("input", () => { cpfInput.value = window.Vitta.cpfFormat(cpfInput.value); });
      const birthDateInput = document.getElementById("field-birthDate");
      const validarDataNascimento = () => {
        if (birthDateInput.validity.rangeOverflow) {
          birthDateInput.setCustomValidity("A data de nascimento deve ser hoje ou anterior.");
        } else if (birthDateInput.validity.badInput && !birthDateInput.value) {
          birthDateInput.setCustomValidity("Digite uma data de nascimento válida.");
        } else {
          birthDateInput.setCustomValidity("");
        }
      };
      birthDateInput.addEventListener("input", validarDataNascimento);
      birthDateInput.addEventListener("change", validarDataNascimento);
      birthDateInput.addEventListener("blur", () => {
        validarDataNascimento();
        if (birthDateInput.validity.badInput || birthDateInput.validity.rangeOverflow) {
          birthDateInput.reportValidity();
        }
      });
    }
    renderizar();
  };
})();
