/* Solicitação de recuperação e definição de uma nova senha. */
(function () {
  const requestForm = document.getElementById("request-reset-form");
  const resetForm = document.getElementById("reset-password-form");
  const message = document.getElementById("recovery-message");

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  if (requestForm) {
    requestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = requestForm.querySelector('[type="submit"]');
      button.disabled = true;
      showMessage("");
      try {
        const result = await window.VittaStorage.requestPasswordReset(
          requestForm.elements.email.value.trim()
        );
        showMessage(result.message);
      } catch (error) {
        showMessage(error.message || "Não foi possível solicitar a recuperação. Tente novamente.", true);
      } finally {
        button.disabled = false;
      }
    });
  }

  if (resetForm) {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(null, "", window.location.pathname);
    window.VittaStorage.validatePasswordReset(token).then((result) => {
      if (result.valid) {
        resetForm.hidden = false;
        return;
      }
      showMessage("Este link é inválido ou expirou. Solicite uma nova recuperação.", true);
    }).catch(() => {
      showMessage("Não foi possível validar este link. Solicite uma nova recuperação.", true);
    });

    resetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = resetForm.elements.password.value;
      const confirmation = resetForm.elements["confirm-password"].value;
      if (password.length < 12 || password.length > 72 || new TextEncoder().encode(password).length > 72 || !/\d/.test(password)) {
        showMessage("A senha deve ter de 12 a 72 caracteres, conter um número e ocupar no máximo 72 bytes.", true);
        return;
      }
      if (password !== confirmation) {
        showMessage("As senhas informadas não coincidem.", true);
        return;
      }

      const button = resetForm.querySelector('[type="submit"]');
      button.disabled = true;
      showMessage("");
      try {
        const result = await window.VittaStorage.resetPassword(token, password, confirmation);
        resetForm.hidden = true;
        showMessage(result.message);
      } catch (error) {
        showMessage(error.message || "Não foi possível redefinir a senha. Solicite um novo link.", true);
      } finally {
        button.disabled = false;
      }
    });
  }
})();
