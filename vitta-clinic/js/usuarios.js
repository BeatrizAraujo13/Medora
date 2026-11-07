/* Gestão administrativa de contas e senhas iniciais. */
(function () {
  window.VittaModules = window.VittaModules || {};
  window.VittaModules.initUsuarios = function () {
    const renderizar = () => {
      const card = window.Vitta.tableFrame({
        title: "Usuários",
        description: "Crie e gerencie contas de acesso à clínica.",
        searchPlaceholder: "Buscar usuário...",
        button: '<button class="button button-primary" type="button" data-add>＋ Novo usuário</button>'
      });
      const rows = window.VittaStorage.all("users").map((user) => ({
        ...user,
        searchText: `${user.name} ${user.email} ${user.role}`
      }));
      window.Vitta.table({
        container: card,
        columns: [
          { label: "Nome", key: "name" },
          { label: "E-mail", key: "email" },
          { label: "Perfil", key: "role" },
          { label: "Status", renderizar: (user) => user.active ? "Ativo" : "Inativo" }
        ],
        rows,
        actions: (user) => `<button type="button" class="button button-secondary button-small" data-edit="${window.Vitta.escaparHtml(user.id)}">Editar</button><button type="button" class="button button-danger button-small" data-delete="${window.Vitta.escaparHtml(user.id)}">Excluir</button>`
      });
      document.querySelector("[data-add]").addEventListener("click", () => editarUsuario());
      card.querySelectorAll("[data-edit]").forEach((button) => {
        button.addEventListener("click", () => editarUsuario(
          window.VittaStorage.all("users").find((user) => user.id === button.dataset.edit)
        ));
      });
      card.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", () => {
          const user = window.VittaStorage.all("users").find((item) => item.id === button.dataset.delete);
          window.Vitta.confirm({
            title: "Excluir usuário?",
            message: `Deseja excluir a conta de ${user.name}?`,
            onConfirm: () => window.VittaStorage.deleteUser(user.id).then(() => {
              window.Vitta.toast("Usuário excluído.");
              return window.VittaStorage.listUsers().then(renderizar);
            })
          });
        });
      });
    };

    function editarUsuario(user) {
      const editing = Boolean(user);
      const roles = [
        { value: "admin", label: "Administrador" },
        { value: "medico", label: "Médico" },
        { value: "recepcionista", label: "Recepcionista" },
        { value: "paciente", label: "Paciente" }
      ];
      const patientOptions = () => {
        const linked = new Set(window.VittaStorage.all("users")
          .filter((entry) => entry.id !== (user && user.id) && entry.patientId)
          .map((entry) => entry.patientId));
        if (user && user.patientId) linked.delete(user.patientId);
        return window.VittaStorage.all("patients")
          .filter((patient) => !linked.has(patient.id))
          .map((patient) => ({ value: patient.id, label: `${patient.name} — ${patient.cpf}` }));
      };
      const roleValue = {
        Administrador: "admin",
        Médico: "medico",
        Recepcionista: "recepcionista",
        Paciente: "paciente"
      };
      window.Vitta.modal({
        title: editing ? "Editar usuário" : "Novo usuário",
        values: user ? {
          ...user,
          role: roleValue[user.role] || user.role,
          patient_id: user.patientId,
          active: String(user.active)
        } : {},
        fields: [
          { name: "name", label: "Nome completo", validation: "name", required: true, full: true },
          { name: "email", label: "E-mail", type: "email", required: true },
          { name: "role", label: "Perfil", type: "select", required: true, options: roles },
          { name: "patient_id", label: "Cadastro do paciente", type: "select", options: patientOptions },
          { name: "password", label: editing ? "Nova senha (opcional)" : "Senha", type: "password", required: !editing, minLength: 12, maxLength: 72 },
          { name: "confirm_password", label: "Confirmar senha", type: "password", required: !editing, minLength: 12, maxLength: 72 },
          ...(editing ? [{ name: "active", label: "Conta ativa", type: "select", required: true, options: [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }] }] : [])
        ],
        onSubmit: (form) => {
          const role = form.role;
          if (role === "paciente" && !form.patient_id) {
            window.Vitta.toast("Selecione o cadastro clínico do paciente.", "error");
            return false;
          }
          if (form.password || form.confirm_password) {
            if (form.password.length < 12 || new TextEncoder().encode(form.password).length > 72 || !/\d/.test(form.password) || form.password !== form.confirm_password) {
              window.Vitta.toast("A senha deve ter de 12 a 72 caracteres, conter um número e coincidir com a confirmação.", "error");
              return false;
            }
          }
          const payload = {
            name: form.name,
            email: form.email,
            role,
            ...(role === "paciente" ? { patient_id: Number(form.patient_id) } : {})
          };
          if (editing) {
            payload.active = form.active === "true";
            if (form.password) {
              payload.password = form.password;
              payload.confirm_password = form.confirm_password;
            }
          } else {
            payload.password = form.password;
            payload.confirm_password = form.confirm_password;
          }
          const save = editing
            ? window.VittaStorage.updateUser(user.id, payload)
            : window.VittaStorage.createUser(payload);
          return save.then(() => window.VittaStorage.listUsers()).then(() => {
            window.Vitta.toast(editing ? "Usuário atualizado." : "Usuário cadastrado.");
            renderizar();
          });
        }
      });
      const roleInput = document.getElementById("field-role");
      const patientInput = document.getElementById("field-patient_id");
      function atualizarVinculo(input = roleInput) {
        const value = input.value;
        const field = patientInput.closest(".field");
        field.style.display = value === "paciente" ? "" : "none";
        patientInput.required = value === "paciente";
      }
      roleInput.addEventListener("change", () => atualizarVinculo());
      atualizarVinculo();
      const activeInput = document.getElementById("field-active");
      if (activeInput && user) activeInput.value = String(user.active);
    }

    renderizar();
  };
})();
