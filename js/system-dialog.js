/* Diálogos internos para substituir prompt/confirm nativos do navegador. */
(function () {
  let dialogo;
  let formulario;
  let titulo;
  let mensagem;
  let grupoCampo;
  let rotuloCampo;
  let campo;
  let confirmar;
  let resolverAtual = null;
  let modoAtual = "confirmar";

  function montarDialogo() {
    if (dialogo) return;

    dialogo = document.createElement("dialog");
    dialogo.className = "system-dialog";
    dialogo.setAttribute("aria-labelledby", "systemDialogTitle");
    dialogo.innerHTML = `
      <form class="system-dialog-form" method="dialog">
        <header class="system-dialog-header">
          <span class="system-dialog-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5Z"></path><path d="m3 12 9 5 9-5M3 16l9 5 9-5"></path></svg>
          </span>
          <div>
            <p class="system-dialog-eyebrow">Atlas Studio</p>
            <h2 id="systemDialogTitle"></h2>
          </div>
        </header>
        <p class="system-dialog-message"></p>
        <label class="system-dialog-field">
          <span></span>
          <input type="text" autocomplete="off" maxlength="160">
        </label>
        <footer class="system-dialog-actions">
          <button class="system-dialog-cancel" type="button">Cancelar</button>
          <button class="system-dialog-confirm" type="submit">Confirmar</button>
        </footer>
      </form>
    `;
    document.body.appendChild(dialogo);

    formulario = dialogo.querySelector("form");
    titulo = dialogo.querySelector("h2");
    mensagem = dialogo.querySelector(".system-dialog-message");
    grupoCampo = dialogo.querySelector(".system-dialog-field");
    rotuloCampo = grupoCampo.querySelector("span");
    campo = grupoCampo.querySelector("input");
    confirmar = dialogo.querySelector(".system-dialog-confirm");

    dialogo.querySelector(".system-dialog-cancel").addEventListener("click", cancelar);
    dialogo.addEventListener("cancel", evento => {
      evento.preventDefault();
      cancelar();
    });
    dialogo.addEventListener("click", evento => {
      if (evento.target === dialogo) cancelar();
    });
    formulario.addEventListener("submit", evento => {
      evento.preventDefault();

      if (modoAtual === "texto") {
        const valor = campo.value.trim();
        if (!valor) {
          campo.setCustomValidity("Informe um valor para continuar.");
          campo.reportValidity();
          return;
        }
        finalizar(valor);
        return;
      }

      finalizar(true);
    });
    campo.addEventListener("input", () => campo.setCustomValidity(""));
  }

  function finalizar(resultado) {
    const resolver = resolverAtual;
    resolverAtual = null;
    if (dialogo.open) dialogo.close();
    resolver?.(resultado);
  }

  function cancelar() {
    finalizar(modoAtual === "texto" ? null : false);
  }

  function abrir(configuracao) {
    montarDialogo();
    if (resolverAtual) cancelar();

    modoAtual = configuracao.modo;
    titulo.textContent = configuracao.titulo;
    mensagem.textContent = configuracao.mensagem || "";
    mensagem.hidden = !configuracao.mensagem;
    grupoCampo.hidden = modoAtual !== "texto";
    rotuloCampo.textContent = configuracao.rotuloCampo || "Nome";
    campo.value = configuracao.valor || "";
    campo.setCustomValidity("");
    confirmar.textContent = configuracao.rotuloConfirmar || "Confirmar";
    confirmar.classList.toggle("danger", Boolean(configuracao.perigo));

    return new Promise(resolve => {
      resolverAtual = resolve;
      dialogo.showModal();
      requestAnimationFrame(() => {
        if (modoAtual === "texto") {
          campo.focus();
          campo.select();
        } else {
          confirmar.focus();
        }
      });
    });
  }

  window.solicitarTextoSistema = function (titulo, mensagem, valor = "", opcoes = {}) {
    return abrir({
      modo: "texto",
      titulo,
      mensagem,
      valor,
      rotuloCampo: opcoes.rotuloCampo,
      rotuloConfirmar: opcoes.rotuloConfirmar || "Salvar"
    });
  };

  window.confirmarSistema = function (titulo, mensagem, opcoes = {}) {
    return abrir({
      modo: "confirmar",
      titulo,
      mensagem,
      rotuloConfirmar: opcoes.rotuloConfirmar,
      perigo: opcoes.perigo
    });
  };
})();
