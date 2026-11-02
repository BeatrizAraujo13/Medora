/* Cadastro de especialidades; impede a exclusão quando há médicos vinculados. */
(function () {
  window.VittaModules = window.VittaModules || {};
  window.VittaModules.initEspecialidades = function () {
    const writable = window.VittaAuth.can("especialidades", "write");
    const renderizar = () => {
      const card = window.Vitta.tableFrame({
        title: "Especialidades",
        description: "Organize as áreas de atendimento disponíveis na clínica.",
        searchPlaceholder: "Buscar especialidade...",
        button: writable ? '<button class="button button-primary" type="button" data-add>＋ Nova especialidade</button>' : ""
      });
      const rows = window.VittaStorage.all("specialties").map((item) => ({ ...item, searchText: `${item.name} ${item.description || ""}` }));
      window.Vitta.table({
        container: card,
        columns: [
          { label: "Especialidade", renderizar: (row) => `<span class="table-primary">${window.Vitta.escaparHtml(row.name)}</span>` },
          { label: "Descrição", renderizar: (row) => window.Vitta.escaparHtml(row.description || "—") },
          { label: "Médicos vinculados", renderizar: (row) => window.VittaStorage.all("doctors").filter((doctor) => doctor.specialtyId === row.id).length }
        ],
        rows,
        actions: writable ? (row) => `<button type="button" class="button button-secondary button-small" data-edit="${window.Vitta.escaparHtml(row.id)}">Editar</button><button type="button" class="button button-danger button-small" data-delete="${window.Vitta.escaparHtml(row.id)}">Excluir</button>` : null
      });
      if (writable) {
        document.querySelector("[data-add]").addEventListener("click", () => editarEspecialidade());
        card.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editarEspecialidade(window.VittaStorage.all("specialties").find((item) => item.id === button.dataset.edit))));
        card.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
          const item = window.VittaStorage.all("specialties").find((entry) => entry.id === button.dataset.delete);
          if (window.VittaStorage.all("doctors").some((doctor) => doctor.specialtyId === item.id)) { window.Vitta.toast("Remova ou atualize os médicos vinculados antes de excluir esta especialidade.", "error"); return; }
          window.Vitta.confirm({ title: "Excluir especialidade?", message: `Deseja excluir ${item.name}?`, onConfirm: () => window.VittaStorage.remove("specialties", item.id).then(() => { window.Vitta.toast("Especialidade excluída."); renderizar(); }) });
        }));
      }
    };
    function editarEspecialidade(item) {
      window.Vitta.modal({
        title: item ? "Editar especialidade" : "Nova especialidade", values: item,
        fields: [{ name: "name", label: "Nome", validation: "name", required: true, full: true }, { name: "description", label: "Descrição", type: "textarea", full: true }],
        onSubmit: (form) => {
          const duplicate = window.VittaStorage.all("specialties").some((entry) => entry.name.toLocaleLowerCase("pt-BR") === form.name.trim().toLocaleLowerCase("pt-BR") && entry.id !== (item && item.id));
          if (duplicate) { window.Vitta.toast("Esta especialidade já está cadastrada.", "error"); return false; }
          return window.VittaStorage.save("specialties", { ...(item || {}), ...form, name: form.name.trim(), id: item ? item.id : window.Vitta.id("esp") }).then(() => {
            window.Vitta.toast(item ? "Especialidade atualizada." : "Especialidade cadastrada.");
            renderizar();
          });
        }
      });
    }
    renderizar();
  };
})();
