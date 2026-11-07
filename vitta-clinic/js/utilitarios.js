/* Funções compartilhadas de apresentação, formulários e validação. */
(function () {
  const escaparHtml = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const regrasDeTexto = {
    name: {
      pattern: /^[\p{L}\p{M} '\u2010-\u2015\u2019-]*$/u,
      message: "Use apenas letras, acentos, espaços, hífens e apóstrofos."
    },
    address: {
      pattern: /^[\p{L}\p{M}\p{N}\p{P}\s]*$/u,
      message: "Use apenas letras, números e pontuação."
    }
  };
  function limparMensagemDeValidacao(input) {
    const mensagem = input.dataset.mensagemValidacaoPtBr;
    if (mensagem && input.validationMessage === mensagem) input.setCustomValidity("");
    delete input.dataset.mensagemValidacaoPtBr;
  }
  function mensagemDeValidacao(input) {
    const label = input.labels && input.labels.length
      ? input.labels[0].textContent.trim().replace(/:\s*$/, "").toLowerCase()
      : "este campo";
    if (input.validity.valueMissing) {
      return input.tagName === "SELECT" ? `Selecione uma opção para ${label}.` : `Preencha o campo "${label}".`;
    }
    if (input.validity.typeMismatch && input.type === "email") return "Informe um endereço de e-mail válido.";
    return `Confira o valor informado para "${label}".`;
  }
  const api = {
    escaparHtml,
    id(prefix) { return window.VittaStorage.newId(prefix); },
    chaveData(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; },
    today() {
      return api.chaveData(new Date());
    },
    date(value) { return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "—"; },
    cpfValid(value) {
      const cpf = String(value || "");
      return /^\d{11}$/.test(cpf) || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
    },
    cpfFormat(value) {
      const cpf = String(value || "").replace(/\D/g, "").slice(0, 11);
      return cpf.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    },
    phoneFormat(value) {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
      if (!digits) return "";
      const areaCode = digits.slice(0, 2);
      const number = digits.slice(2);
      const formattedNumber = number.length > 4 ? `${number.slice(0, -4)}-${number.slice(-4)}` : number;
      return `(${areaCode}${areaCode.length === 2 ? ") " : ""}${formattedNumber}`;
    },
    validateForm(form) {
      Array.from(form.elements).forEach((input) => {
        if (!input.willValidate) return;
        limparMensagemDeValidacao(input);
        if (input.validity.valid || input.validity.customError) return;
        const mensagem = mensagemDeValidacao(input);
        if (mensagem) {
          input.setCustomValidity(mensagem);
          input.dataset.mensagemValidacaoPtBr = mensagem;
        }
      });
      return form.reportValidity();
    },
    toast(message, type) {
      const region = document.getElementById("toast-region");
      if (!region) return;
      const toast = document.createElement("div");
      toast.className = "toast " + (type || "success");
      toast.setAttribute("role", "status");
      toast.textContent = message;
      region.appendChild(toast);
      window.setTimeout(() => toast.remove(), 3600);
    },
    closeModal() {
      const root = document.getElementById("modal-root");
      if (root) root.replaceChildren();
    },
    modal({ title, fields, values, onSubmit, size }) {
      const root = document.getElementById("modal-root");
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `<section class="modal ${size === "small" ? "modal-small" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${escaparHtml(title)}</h2><button type="button" class="icon-button modal-close" aria-label="Fechar">×</button></header><div class="modal-content"><form class="form-grid"></form></div></section>`;
      const form = backdrop.querySelector("form");
      form.noValidate = true;
      (fields || []).forEach((field) => {
        const wrapper = document.createElement("div");
        wrapper.className = "field" + (field.full ? " full" : "");
        const label = document.createElement("label");
        label.htmlFor = "field-" + field.name;
        label.textContent = field.label;
        const value = values && values[field.name] != null ? values[field.name] : (field.value || "");
        let input;
        if (field.type === "select") {
          input = document.createElement("select");
          const blank = document.createElement("option");
          blank.value = "";
          blank.textContent = field.placeholder || "Selecione";
          input.appendChild(blank);
          (typeof field.options === "function" ? field.options() : field.options || []).forEach((option) => {
            const item = document.createElement("option");
            item.value = option.value;
            item.textContent = option.label;
            input.appendChild(item);
          });
        } else if (field.type === "textarea") {
          input = document.createElement("textarea");
          input.placeholder = field.placeholder || "";
        } else {
          input = document.createElement("input");
          input.type = field.type || "text";
          input.placeholder = field.placeholder || "";
          if (field.type === "tel") {
            input.inputMode = "numeric";
            input.maxLength = 15;
          }
        }
        input.id = "field-" + field.name;
        input.name = field.name;
        input.value = value;
        input.required = Boolean(field.required);
        if (field.maxLength) input.maxLength = field.maxLength;
        if (field.minLength) input.minLength = field.minLength;
        if (field.min) input.min = field.min;
        if (field.max) input.max = field.max;
        if (field.readOnly) input.readOnly = true;
        const regraDeTexto = regrasDeTexto[field.validation];
        if (regraDeTexto) {
          const validarTexto = () => {
            input.setCustomValidity(regraDeTexto.pattern.test(input.value) ? "" : regraDeTexto.message);
          };
          input.addEventListener("input", validarTexto);
          validarTexto();
        }
        if (field.type === "tel") input.addEventListener("input", () => { input.value = api.phoneFormat(input.value); });
        if (field.onChange) input.addEventListener("change", () => field.onChange(input, form));
        wrapper.append(label, input);
        form.appendChild(wrapper);
      });
      const actions = document.createElement("div");
      actions.className = "form-actions full";
      actions.innerHTML = '<button type="button" class="button button-secondary modal-cancel">Cancelar</button><button type="submit" class="button button-primary">Salvar</button>';
      form.appendChild(actions);
      root.replaceChildren(backdrop);
      const firstInput = form.querySelector("input,select,textarea");
      if (firstInput) firstInput.focus();
      backdrop.querySelectorAll(".modal-close,.modal-cancel").forEach((button) => button.addEventListener("click", api.closeModal));
      backdrop.addEventListener("click", (event) => { if (event.target === backdrop) api.closeModal(); });
      backdrop.addEventListener("keydown", (event) => { if (event.key === "Escape") api.closeModal(); });
      form.addEventListener("input", (event) => {
        if (event.target && event.target.willValidate) limparMensagemDeValidacao(event.target);
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!api.validateForm(form)) return;
        const data = Object.fromEntries(new FormData(form).entries());
        const resultado = onSubmit(data);
        if (resultado && typeof resultado.then === "function") {
          const botao = form.querySelector('[type="submit"]');
          botao.disabled = true;
          resultado.then((fechar) => {
            if (fechar !== false) api.closeModal();
          }).catch((error) => {
            api.toast(error.message || "Não foi possível salvar as alterações.", "error");
          }).finally(() => { botao.disabled = false; });
        } else if (resultado !== false) api.closeModal();
      });
    },
    confirm({ title, message, onConfirm }) {
      const root = document.getElementById("modal-root");
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.innerHTML = `<section class="modal modal-small" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${escaparHtml(title)}</h2><button type="button" class="icon-button modal-close" aria-label="Fechar">×</button></header><div class="modal-content"><p class="modal-copy">${escaparHtml(message)}</p><div class="form-actions"><button type="button" class="button button-secondary modal-cancel">Cancelar</button><button type="button" class="button button-danger confirm-action">Excluir</button></div></div></section>`;
      root.replaceChildren(backdrop);
      backdrop.querySelectorAll(".modal-close,.modal-cancel").forEach((button) => button.addEventListener("click", api.closeModal));
      backdrop.querySelector(".confirm-action").addEventListener("click", (event) => {
        const botao = event.currentTarget;
        const resultado = onConfirm();
        if (resultado && typeof resultado.then === "function") {
          botao.disabled = true;
          resultado.then(() => api.closeModal()).catch((error) => {
            api.toast(error.message || "Não foi possível excluir o registro.", "error");
          }).finally(() => { botao.disabled = false; });
        } else api.closeModal();
      });
      backdrop.addEventListener("click", (event) => { if (event.target === backdrop) api.closeModal(); });
      backdrop.querySelector(".confirm-action").focus();
    },
    table({ container, columns, rows, actions, search = true, emptyText = "Nenhum registro encontrado." }) {
      let page = 0;
      const pageSize = 8;
      const searchInput = container.querySelector("[data-table-search]");
      const renderizar = () => {
        const term = searchInput ? searchInput.value.trim().toLocaleLowerCase("pt-BR") : "";
        const filtered = term ? rows.filter((row) => (row.searchText || JSON.stringify(row)).toLocaleLowerCase("pt-BR").includes(term)) : rows;
        const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
        page = Math.min(page, pageCount - 1);
        const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
        const headers = columns.map((column) => `<th>${escaparHtml(column.label)}</th>`).join("") + (actions ? "<th>Ações</th>" : "");
        const body = pageRows.length ? pageRows.map((row) => `<tr>${columns.map((column) => `<td>${column.renderizar ? column.renderizar(row) : escaparHtml(row[column.key])}</td>`).join("")}${actions ? `<td><div class="table-actions">${actions(row)}</div></td>` : ""}</tr>`).join("") : `<tr><td colspan="${columns.length + (actions ? 1 : 0)}"><div class="empty-state">${escaparHtml(emptyText)}</div></td></tr>`;
        container.querySelector("thead").innerHTML = `<tr>${headers}</tr>`;
        container.querySelector("tbody").innerHTML = body;
        const start = filtered.length ? page * pageSize + 1 : 0;
        container.querySelector("[data-pagination-label]").textContent = `${start}–${Math.min((page + 1) * pageSize, filtered.length)} de ${filtered.length}`;
        container.querySelector("[data-prev]").disabled = page === 0;
        container.querySelector("[data-next]").disabled = page >= pageCount - 1;
      };
      if (searchInput && search) searchInput.addEventListener("input", () => { page = 0; renderizar(); });
      container.querySelector("[data-prev]").addEventListener("click", () => { page--; renderizar(); });
      container.querySelector("[data-next]").addEventListener("click", () => { page++; renderizar(); });
      renderizar();
    },
    tableFrame({ title, description, button, searchPlaceholder }) {
      const root = document.querySelector("[data-page-content]");
      root.innerHTML = `<div class="page-heading"><div><h1>${escaparHtml(title)}</h1><p>${escaparHtml(description)}</p></div>${button || ""}</div><section class="content-card"><div class="toolbar">${searchPlaceholder ? `<input class="toolbar-search" data-table-search type="search" aria-label="Buscar" placeholder="${escaparHtml(searchPlaceholder)}">` : "<span></span>"}<div class="toolbar-filters" data-extra-filters></div></div><div class="table-wrap"><table class="data-table"><thead></thead><tbody></tbody></table></div><div class="table-pagination"><span data-pagination-label></span><div><button class="button button-secondary button-small" type="button" data-prev aria-label="Página anterior">Anterior</button> <button class="button button-secondary button-small" type="button" data-next aria-label="Próxima página">Próxima</button></div></div></section>`;
      return root.querySelector(".content-card");
    },
    appointmentName(appointment) {
      const patient = window.VittaStorage.all("patients").find((item) => item.id === appointment.patientId);
      const doctor = window.VittaStorage.all("doctors").find((item) => item.id === appointment.doctorId);
      return { patient: patient ? patient.name : "Paciente removido", doctor: doctor ? doctor.name : "Médico removido" };
    }
  };
  window.Vitta = api;
})();
