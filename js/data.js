/*
  Dados do projeto.
  Fontes XLS/XLSX/CSV, relações e importação/exportação de backup.
*/

/* =========================================================
   UI — FONTES DE DADOS / XLS / XLSX
   ========================================================= */

function tituloFonteRegistro(
  fonte,
  registro
) {
  return String(
    registro?.values?.[
      fonte.titleColumn
    ] ??
    registro?.id ??
    ""
  ).trim();
}

function atualizarFontesDadosUI() {
  if (!mapaAtual) {
    return;
  }

  listaFontesDados.innerHTML = "";

  const fontes =
    mapaAtual.fontesDados ||
    [];

  if (
    importarPlanilha.parentElement !==
    listaFontesDados.parentElement
  ) {
    listaFontesDados.parentElement.insertBefore(
      importarPlanilha,
      listaFontesDados
    );
  }

  if (!fontes.length) {
    const vazio =
      document.createElement(
        "div"
      );

    vazio.className =
      "data-source-empty";

    vazio.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 10h16M10 4v16"></path></svg>' +
      '<span>Nenhuma fonte de dados importada ainda.</span>';

    vazio.appendChild(
      importarPlanilha
    );

    listaFontesDados.appendChild(
      vazio
    );

    atualizarFontesObjeto();
    atualizarFontesRelacao();

    return;
  }

  for (const fonte of fontes) {
    const item =
      document.createElement(
        "div"
      );

    item.className =
      "fonte-item";

    const info =
      document.createElement(
        "div"
      );

    info.className =
      "fonte-info";

    info.innerHTML =
      "<strong>" +
      esc(fonte.nome) +
      "</strong>" +
      "<small>" +
      esc(
        fonte.entityType ||
        "Dados"
      ) +
      " · " +
      fonte.records.length +
      " registro(s)</small>";

    const acoes =
      document.createElement(
        "div"
      );

    acoes.className =
      "fonte-acoes";

    const configurar =
      document.createElement(
        "button"
      );

    configurar.type =
      "button";
    configurar.textContent =
      "⚙";
    configurar.title =
      "Configurar campos exibidos";

    configurar.addEventListener(
      "click",
      () =>
        abrirConfiguracaoFonte(
          fonte
        )
    );

    const atualizar =
      document.createElement(
        "button"
      );

    atualizar.type =
      "button";
    atualizar.textContent =
      "↻";
    atualizar.title =
      "Atualizar usando nova planilha";

    atualizar.addEventListener(
      "click",
      () => {
        importador.modo =
          "atualizar";
        importador.fonteId =
          fonte.id;
        arquivoPlanilha.click();
      }
    );

    const remover =
      document.createElement(
        "button"
      );

    remover.type =
      "button";
    remover.textContent =
      "×";
    remover.title =
      "Remover fonte";

    remover.addEventListener(
      "click",
      () =>
        excluirFonteDados(
          fonte
        )
    );

    acoes.append(
      configurar,
      atualizar,
      remover
    );

    item.append(
      info,
      acoes
    );

    listaFontesDados.appendChild(
      item
    );
  }

  atualizarFontesObjeto();
  atualizarFontesRelacao();
}

function headersDaAba(sheetName) {
  if (!importador.workbook) {
    return [];
  }

  const sheet =
    importador.workbook.Sheets[
      sheetName
    ];

  const matriz =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false
      }
    );

  const primeira =
    matriz[0] ||
    [];

  const usados =
    new Map();

  return primeira.map(
    (valor, indice) => {
      let nome =
        String(valor || "")
          .trim();

      if (!nome) {
        nome =
          "coluna_" +
          (indice + 1);
      }

      const n =
        usados.get(nome) ||
        0;

      usados.set(
        nome,
        n + 1
      );

      if (n) {
        nome +=
          "_" +
          (n + 1);
      }

      return nome;
    }
  );
}

function linhasDaAba(
  sheetName,
  headers
) {
  const sheet =
    importador.workbook.Sheets[
      sheetName
    ];

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      header: headers,
      range: 1,
      defval: "",
      raw: false,
      blankrows: false
    }
  );
}

function preencherSelectColunas(
  select,
  headers,
  valor = "",
  incluirLinha = false
) {
  select.innerHTML = "";

  if (incluirLinha) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      "__linha__";

    option.textContent =
      "Gerar ID pelo número da linha";

    select.appendChild(
      option
    );
  }

  for (const h of headers) {
    const option =
      document.createElement(
        "option"
      );

    option.value = h;
    option.textContent = h;

    select.appendChild(
      option
    );
  }

  if (
    valor &&
    Array.from(
      select.options
    ).some(
      o => o.value === valor
    )
  ) {
    select.value = valor;
  }
}

function cabecalhoProvavel(
  headers,
  nomes
) {
  const normal =
    s =>
      String(s)
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase();

  for (const desejado of nomes) {
    const achou =
      headers.find(
        h =>
          normal(h) ===
          normal(desejado)
      );

    if (achou) {
      return achou;
    }
  }

  return headers[0] || "";
}

function renderCamposFonte(
  headers,
  selecionados = []
) {
  const mapaSelecionados =
    new Map(
      selecionados.map(
        c =>
          [
            c.column,
            c.label
          ]
      )
    );

  camposFonteDados.innerHTML =
    "";

  for (const h of headers) {
    const linha =
      document.createElement(
        "label"
      );

    linha.className =
      "campo-planilha";

    const checkbox =
      document.createElement(
        "input"
      );

    checkbox.type =
      "checkbox";

    checkbox.dataset.column =
      h;

    checkbox.checked =
      mapaSelecionados.has(h);

    const nomeColuna =
      document.createElement(
        "span"
      );

    nomeColuna.textContent =
      h;

    const label =
      document.createElement(
        "input"
      );

    label.type =
      "text";

    label.dataset.labelFor =
      h;

    label.value =
      mapaSelecionados.get(h) ||
      h;

    label.placeholder =
      "Rótulo exibido";

    linha.append(
      checkbox,
      nomeColuna,
      label
    );

    camposFonteDados.appendChild(
      linha
    );
  }
}

function camposSelecionadosFonte() {
  const resultado = [];

  const checks =
    camposFonteDados.querySelectorAll(
      'input[type="checkbox"]'
    );

  for (const check of checks) {
    if (!check.checked) {
      continue;
    }

    const coluna =
      check.dataset.column;

    const input =
      camposFonteDados.querySelector(
        'input[data-label-for="' +
        CSS.escape(coluna) +
        '"]'
      );

    resultado.push({
      column: coluna,
      label:
        input?.value.trim() ||
        coluna
    });
  }

  return resultado;
}

function atualizarAbaImportacao(
  configuracao = null
) {
  const aba =
    abaFonteDados.value;

  if (!aba) {
    return;
  }

  importador.headers =
    headersDaAba(aba);

  importador.linhas =
    linhasDaAba(
      aba,
      importador.headers
    );

  const idPadrao =
    configuracao?.idColumn ||
    cabecalhoProvavel(
      importador.headers,
      [
        "id",
        "id_npc",
        "id_recurso",
        "codigo",
        "código"
      ]
    );

  const tituloPadrao =
    configuracao?.titleColumn ||
    cabecalhoProvavel(
      importador.headers,
      [
        "nome",
        "name",
        "titulo",
        "título"
      ]
    );

  preencherSelectColunas(
    colunaIdFonte,
    importador.headers,
    idPadrao,
    true
  );

  preencherSelectColunas(
    colunaTituloFonte,
    importador.headers,
    tituloPadrao,
    false
  );

  const defaults =
    configuracao?.displayFields ||
    importador.headers
      .filter(
        h => {
          const n =
            h.normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .toLowerCase();

          return [
            "nome",
            "idade",
            "tipo",
            "profissao",
            "raridade",
            "descricao"
          ].includes(n);
        }
      )
      .slice(0, 6)
      .map(
        h => ({
          column: h,
          label: h
        })
      );

  renderCamposFonte(
    importador.headers,
    defaults
  );
}

function abrirModalFonteNovo() {
  tituloModalFonte.textContent =
    importador.modo === "atualizar"
      ? "Atualizar planilha"
      : "Importar planilha";

  campoAbaFonte.hidden =
    false;

  resumoAtualizacaoFonte.hidden =
    true;

  const antiga =
    importador.modo === "atualizar"
      ? fontePorId(
          importador.fonteId
        )
      : null;

  nomeFonteDados.value =
    antiga?.nome ||
    importador.arquivoNome
      .replace(
        /\.[^.]+$/,
        ""
      );

  tipoEntidadeFonte.value =
    antiga?.entityType ||
    "";

  abaFonteDados.innerHTML = "";

  for (
    const sheetName of
    importador.workbook.SheetNames
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value = sheetName;
    option.textContent = sheetName;

    abaFonteDados.appendChild(
      option
    );
  }

  if (
    antiga?.sheetName &&
    importador.workbook.SheetNames.includes(
      antiga.sheetName
    )
  ) {
    abaFonteDados.value =
      antiga.sheetName;
  }

  atualizarAbaImportacao(
    antiga
  );

  modalFonteDados.hidden =
    false;
}

function abrirConfiguracaoFonte(
  fonte
) {
  importador.modo =
    "configurar";

  importador.fonteId =
    fonte.id;

  importador.workbook =
    null;

  tituloModalFonte.textContent =
    "Configurar exibição";

  campoAbaFonte.hidden =
    true;

  resumoAtualizacaoFonte.hidden =
    true;

  nomeFonteDados.value =
    fonte.nome;

  tipoEntidadeFonte.value =
    fonte.entityType ||
    "";

  importador.headers =
    clone(
      fonte.headers ||
      []
    );

  preencherSelectColunas(
    colunaIdFonte,
    importador.headers,
    fonte.idColumn,
    true
  );

  colunaIdFonte.disabled =
    true;

  preencherSelectColunas(
    colunaTituloFonte,
    importador.headers,
    fonte.titleColumn,
    false
  );

  renderCamposFonte(
    importador.headers,
    fonte.displayFields ||
    []
  );

  modalFonteDados.hidden =
    false;
}

function fecharModalFonteDados() {
  modalFonteDados.hidden =
    true;

  colunaIdFonte.disabled =
    false;

  importador.workbook =
    null;

  importador.headers = [];
  importador.linhas = [];
}

function construirRegistrosFonte(
  idColumn
) {
  const registros = [];
  const usados = new Set();

  for (
    let i = 0;
    i < importador.linhas.length;
    i++
  ) {
    const row =
      importador.linhas[i];

    let id =
      idColumn === "__linha__"
        ? "linha_" +
          (i + 2)
        : String(
            row[idColumn] ??
            ""
          ).trim();

    if (!id) {
      continue;
    }

    if (usados.has(id)) {
      throw new Error(
        'ID duplicado na planilha: "' +
        id +
        '".'
      );
    }

    usados.add(id);

    registros.push({
      id,
      values:
        clone(row),
      ausenteNaAtualizacao:
        false
    });
  }

  return registros;
}

async function salvarFonteDadosForm() {
  const nome =
    nomeFonteDados.value.trim();

  const entityType =
    tipoEntidadeFonte.value.trim();

  const titleColumn =
    colunaTituloFonte.value;

  const displayFields =
    camposSelecionadosFonte();

  if (!nome) {
    throw new Error(
      "Informe um nome para a fonte."
    );
  }

  if (!titleColumn) {
    throw new Error(
      "Escolha a coluna usada como nome."
    );
  }

  if (
    importador.modo ===
    "configurar"
  ) {
    const fonte =
      fontePorId(
        importador.fonteId
      );

    if (!fonte) {
      throw new Error(
        "Fonte não encontrada."
      );
    }

    fonte.nome = nome;
    fonte.entityType =
      entityType;
    fonte.titleColumn =
      titleColumn;
    fonte.displayFields =
      displayFields;

    await dbSalvar(
      mapaAtual
    );

    await sincronizarFontesCompartilhadas();

    fecharModalFonteDados();
    atualizarFontesDadosUI();
    renderMapaCompleto();

    avisar(
      "Exibição atualizada."
    );

    return;
  }

  const sheetName =
    abaFonteDados.value;

  const idColumn =
    colunaIdFonte.value;

  const novos =
    construirRegistrosFonte(
      idColumn
    );

  if (!novos.length) {
    throw new Error(
      "Nenhum registro válido foi encontrado."
    );
  }

  if (
    importador.modo ===
    "atualizar"
  ) {
    const fonte =
      fontePorId(
        importador.fonteId
      );

    if (!fonte) {
      throw new Error(
        "Fonte não encontrada."
      );
    }

    const novosMap =
      new Map(
        novos.map(
          r =>
            [
              String(r.id),
              r
            ]
        )
      );

    let ausentes = 0;

    for (
      const antigo of
      fonte.records
    ) {
      if (
        !novosMap.has(
          String(antigo.id)
        )
      ) {
        const preservado =
          clone(antigo);

        preservado.ausenteNaAtualizacao =
          true;

        novos.push(
          preservado
        );

        ausentes++;
      }
    }

    fonte.nome = nome;
    fonte.entityType =
      entityType;
    fonte.fileName =
      importador.arquivoNome;
    fonte.sheetName =
      sheetName;
    fonte.headers =
      clone(
        importador.headers
      );
    fonte.idColumn =
      idColumn;
    fonte.titleColumn =
      titleColumn;
    fonte.displayFields =
      displayFields;
    fonte.records =
      novos;

    await dbSalvar(
      mapaAtual
    );

    await sincronizarFontesCompartilhadas();

    fecharModalFonteDados();
    atualizarFontesDadosUI();
    renderMapaCompleto();

    avisar(
      "Planilha atualizada" +
      (
        ausentes
          ? ". " +
            ausentes +
            " registro(s) ausente(s) foram preservados."
          : "."
      )
    );

    return;
  }

  const ids =
    new Set(
      mapaAtual.fontesDados.map(
        f => f.id
      )
    );

  const fonte = {
    id:
      idUnico(
        nome,
        ids
      ),
    nome,
    entityType,
    fileName:
      importador.arquivoNome,
    sheetName,
    headers:
      clone(
        importador.headers
      ),
    idColumn,
    titleColumn,
    displayFields,
    records:
      novos
  };

  mapaAtual.fontesDados.push(
    fonte
  );

  await dbSalvar(
    mapaAtual
  );

  await sincronizarFontesCompartilhadas();

  fecharModalFonteDados();
  atualizarFontesDadosUI();

  avisar(
    "Planilha importada."
  );
}

async function excluirFonteDados(
  fonte
) {
  let referencias = 0;

  for (
    const obj of
    mapaAtual.objetos
  ) {
    if (
      obj.entityRef?.sourceId ===
      fonte.id
    ) {
      referencias++;
    }

    for (
      const rel of
      obj.relacoes ||
      []
    ) {
      if (
        rel.entityRef?.sourceId ===
        fonte.id
      ) {
        referencias++;
      }
    }
  }

  const mensagem =
    'Remover a fonte "' +
    fonte.nome +
    '"?' +
    (
      referencias
        ? "\n\n" +
          referencias +
          " vínculo(s) serão desconectados, mas os objetos do mapa serão mantidos."
        : ""
    );

  if (
    !await confirmarSistema(
      "Remover fonte de dados",
      mensagem,
      {
        rotuloConfirmar: "Remover fonte",
        perigo: true
      }
    )
  ) {
    return;
  }

  mapaAtual.fontesDados =
    mapaAtual.fontesDados.filter(
      f => f.id !== fonte.id
    );

  for (
    const obj of
    mapaAtual.objetos
  ) {
    if (
      obj.entityRef?.sourceId ===
      fonte.id
    ) {
      delete obj.entityRef;
    }

    obj.relacoes =
      (obj.relacoes || [])
        .filter(
          rel =>
            rel.entityRef?.sourceId !==
            fonte.id
        );
  }

  await dbSalvar(
    mapaAtual
  );

  await sincronizarFontesCompartilhadas();

  atualizarFontesDadosUI();
  renderMapaCompleto();

  avisar(
    "Fonte removida."
  );
}


/* =========================================================
   CAMPOS VISÍVEIS POR OBJETO E VÍNCULO
   ========================================================= */

function camposDisponiveisFonte(fonte) {
  if (!fonte) {
    return [];
  }

  const padrao =
    Array.isArray(
      fonte.displayFields
    )
      ? fonte.displayFields
      : [];

  return padrao.filter(
    campo =>
      campo.column !==
      fonte.titleColumn
  );
}

function renderCampoPicker(
  container,
  group,
  fonte,
  selecionados = null
) {
  container.innerHTML = "";

  if (!fonte) {
    group.hidden = true;
    return;
  }

  const campos =
    camposDisponiveisFonte(
      fonte
    );

  if (!campos.length) {
    group.hidden = true;
    return;
  }

  const conjunto =
    Array.isArray(selecionados)
      ? new Set(selecionados)
      : null;

  for (const campo of campos) {
    const label =
      document.createElement(
        "label"
      );

    label.className =
      "object-field-row";

    const check =
      document.createElement(
        "input"
      );

    check.type =
      "checkbox";

    check.value =
      campo.column;

    check.checked =
      conjunto
        ? conjunto.has(
            campo.column
          )
        : true;

    const texto =
      document.createElement(
        "span"
      );

    texto.textContent =
      campo.label ||
      campo.column;

    label.append(
      check,
      texto
    );

    container.appendChild(
      label
    );
  }

  group.hidden = false;
}

function camposMarcados(container) {
  return Array.from(
    container.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  ).map(
    input =>
      input.value
  );
}

function renderCamposReferenciaObjeto(
  selecionados = null
) {
  renderCampoPicker(
    camposReferenciaObjeto,
    grupoCamposReferenciaObjeto,
    fontePorId(
      fonteObjeto.value
    ),
    selecionados
  );
}

function renderCamposRelacaoObjeto(
  selecionados = null
) {
  renderCampoPicker(
    camposRelacaoObjeto,
    grupoCamposRelacao,
    fontePorId(
      fonteRelacao.value
    ),
    selecionados
  );
}

function atualizarFontesObjeto(
  ref = null,
  fieldColumns = null
) {
  const valorFonte =
    ref?.sourceId ||
    fonteObjeto.value ||
    "";

  fonteObjeto.innerHTML =
    '<option value="">Nenhuma</option>';

  for (
    const fonte of
    mapaAtual?.fontesDados ||
    []
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value = fonte.id;
    option.textContent =
      fonte.nome +
      (
        fonte.entityType
          ? " — " +
            fonte.entityType
          : ""
      );

    fonteObjeto.appendChild(
      option
    );
  }

  fonteObjeto.value =
    valorFonte;

  atualizarRegistrosObjeto(
    ref?.recordId ||
    ""
  );

  renderCamposReferenciaObjeto(
    fieldColumns
  );
}

function atualizarRegistrosObjeto(
  selecionado = ""
) {
  registroObjeto.innerHTML =
    '<option value="">Nenhum</option>';

  const fonte =
    fontePorId(
      fonteObjeto.value
    );

  if (!fonte) {
    registroObjeto.disabled =
      true;
    return;
  }

  registroObjeto.disabled =
    false;

  const registros =
    [...fonte.records]
      .sort(
        (a, b) =>
          tituloFonteRegistro(
            fonte,
            a
          ).localeCompare(
            tituloFonteRegistro(
              fonte,
              b
            ),
            "pt-BR"
          )
      );

  for (const registro of registros) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      registro.id;

    option.textContent =
      tituloFonteRegistro(
        fonte,
        registro
      ) +
      (
        registro.ausenteNaAtualizacao
          ? " [ausente]"
          : ""
      );

    registroObjeto.appendChild(
      option
    );
  }

  registroObjeto.value =
    selecionado;
}

function atualizarFontesRelacao() {
  const atual =
    fonteRelacao.value;

  fonteRelacao.innerHTML =
    '<option value="">Selecione</option>';

  for (
    const fonte of
    mapaAtual?.fontesDados ||
    []
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value = fonte.id;
    option.textContent =
      fonte.nome;

    fonteRelacao.appendChild(
      option
    );
  }

  if (
    Array.from(
      fonteRelacao.options
    ).some(
      o => o.value === atual
    )
  ) {
    fonteRelacao.value =
      atual;
  }

  atualizarRegistrosRelacao();
}

function atualizarRegistrosRelacao() {
  registroRelacao.innerHTML =
    '<option value="">Selecione</option>';

  const fonte =
    fontePorId(
      fonteRelacao.value
    );

  if (!fonte) {
    registroRelacao.disabled =
      true;
    return;
  }

  registroRelacao.disabled =
    false;

  for (
    const registro of
    [...fonte.records].sort(
      (a, b) =>
        tituloFonteRegistro(
          fonte,
          a
        ).localeCompare(
          tituloFonteRegistro(
            fonte,
            b
          ),
          "pt-BR"
        )
    )
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      registro.id;

    option.textContent =
      tituloFonteRegistro(
        fonte,
        registro
      );

    registroRelacao.appendChild(
      option
    );
  }
}

function renderRelacoesEditor() {
  listaRelacoesArea.innerHTML =
    "";

  for (
    let i = 0;
    i < editor.relacoes.length;
    i++
  ) {
    const rel =
      editor.relacoes[i];

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "relacao-item";

    const info =
      document.createElement(
        "div"
      );

    info.className =
      "relacao-info";

    info.innerHTML =
      "<strong>" +
      esc(
        rel.rotulo ||
        "Relação"
      ) +
      "</strong>" +
      "<small>" +
      esc(
        tituloRegistro(
          rel.entityRef
        ) ||
        "Registro não encontrado"
      ) +
      (
        Array.isArray(rel.fields)
          ? " · " +
            rel.fields.length +
            " campo(s)"
          : ""
      ) +
      "</small>";

    const remover =
      document.createElement(
        "button"
      );

    remover.type =
      "button";

    remover.textContent =
      "×";

    remover.addEventListener(
      "click",
      () => {
        editor.relacoes.splice(
          i,
          1
        );

        renderRelacoesEditor();
      }
    );

    item.append(
      info,
      remover
    );

    listaRelacoesArea.appendChild(
      item
    );
  }
}

function adicionarRelacaoAtual() {
  if (
    !fonteRelacao.value ||
    !registroRelacao.value
  ) {
    avisar(
      "Escolha uma fonte e um registro."
    );
    return;
  }

  editor.relacoes.push({
    rotulo:
      rotuloRelacao.value.trim() ||
      fontePorId(
        fonteRelacao.value
      )?.nome ||
      "Relação",

    fields:
      camposMarcados(
        camposRelacaoObjeto
      ),

    entityRef: {
      sourceId:
        fonteRelacao.value,
      recordId:
        registroRelacao.value
    }
  });

  rotuloRelacao.value = "";

  renderRelacoesEditor();
}

/* =========================================================
   BACKUP
   ========================================================= */

async function salvarProjetoAtual(
  opcoes = {}
) {
  if (!projetoAtual) {
    avisar("Abra um projeto antes de salvar.");
    return false;
  }

  /* Uma edição válida que ainda está no inspetor também faz parte do
     salvamento explícito. Rascunhos incompletos permanecem na tela. */
  if (
    !modalCategoria.hidden &&
    ui.inspectorTab === "criacao"
  ) {
    await salvarCategoriaForm();
  } else if (
    editor.ativo
  ) {
    await editor.carregamento;
    await salvarObjetoAtual();
  }

  projetoAtual = {
    ...projetoAtual
  };

  await dbSalvarProjeto(
    projetoAtual
  );
  finalizarHistoricoGlobalPendente();
  mostrarEstadoSalvamento(sessaoRascunho ? "pendente" : "salvo");

  if (opcoes.notificar !== false) {
    avisar("Projeto salvo.");
  }

  return true;
}

async function montarBackupProjetoAtual() {
  if (!projetoAtual) {
    throw new Error(
      "Abra um projeto antes de exportar."
    );
  }

  const projeto =
    await dbPegarProjeto(
      projetoAtual.id
    );
  const mapas =
    await dbTodos();

  return {
    formato:
      "atlas-studio-project",
    schemaVersion: 2,
    versaoEditor: 12.5,
    exportadoEm:
      new Date().toISOString(),
    projeto:
      clone(
        projeto || projetoAtual
      ),
    mapas:
      clone(mapas)
  };
}

async function exportarBackupAtual() {
  if (!projetoAtual) {
    avisar("Abra um projeto antes de exportar.");
    return;
  }

  await salvarProjetoAtual({
    notificar: false
  });

  const pacote =
    await montarBackupProjetoAtual();

  const quantidadeObjetos =
    pacote.mapas.reduce(
      (total, mapa) =>
        total +
        (mapa.objetos?.length || 0),
      0
    );

  const blob =
    new Blob(
      [
        JSON.stringify(
          pacote,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href =
    url;

  a.download =
    slug(
      pacote.projeto.nome
    ) +
    ".atlasproject";

  document.body.appendChild(
    a
  );

  a.click();
  projetoAtual.ultimoBackupExportadoEm = new Date().toISOString();
  await dbSalvarProjeto(projetoAtual);
  atualizarIndicadorBackup();

  document.body.removeChild(
    a
  );

  URL.revokeObjectURL(
    url
  );

  avisar(
    `Projeto exportado com ${pacote.mapas.length} mapa(s) e ${quantidadeObjetos} objeto(s).`
  );
}

function remapearPortaisMapa(
  mapa,
  idsMapas
) {
  for (const objeto of mapa.objetos || []) {
    for (
      const campo of [
        "portalDestinoMapaId",
        "portalOrigemMapaId",
        "portalParMapaId",
        "relacaoOrigemMapaId", "relacaoDestinoMapaId"
      ]
    ) {
      if (
        objeto[campo] &&
        idsMapas.has(objeto[campo])
      ) {
        objeto[campo] =
          idsMapas.get(
            objeto[campo]
          );
      }
    }
  }

  return mapa;
}

function prepararProjetoImportado(
  pacote,
  idsExistentes
) {
  validarPacoteProjeto(pacote);
  if (
    pacote?.formato !==
      "atlas-studio-project" ||
    !pacote.projeto?.nome ||
    !Array.isArray(pacote.mapas)
  ) {
    throw new Error(
      "Arquivo de projeto inválido."
    );
  }

  const projeto = {
    ...clone(pacote.projeto),
    id: gerarIdProjeto(),
    importadoEm:
      new Date().toISOString(),
    schemaVersion: 1
  };
  const usados =
    new Set(idsExistentes);
  const idsMapas =
    new Map();
  const idsDoPacote = new Set(pacote.mapas.map(m => m.id));
  // Não permitir que um destino ausente passe a apontar por coincidência
  // para o novo ID gerado para outro mapa durante a importação.
  for (const m of pacote.mapas) {
    for (const obj of m.objetos || []) {
      for (const campo of ["portalDestinoMapaId", "portalOrigemMapaId", "portalParMapaId", "relacaoOrigemMapaId", "relacaoDestinoMapaId"]) {
        if (obj[campo] && !idsDoPacote.has(obj[campo])) usados.add(obj[campo]);
      }
    }
  }

  for (
    const [indice, mapa] of
    pacote.mapas.entries()
  ) {
    if (
      !mapa?.id ||
      !mapa?.nome ||
      !mapa?.imagem
    ) {
      throw new Error(
        `O mapa ${indice + 1} do projeto é inválido.`
      );
    }

    if (idsMapas.has(mapa.id)) {
      throw new Error(
        "O projeto contém IDs de mapas duplicados."
      );
    }

    const novoId =
      idUnico(
        mapa.nome,
        usados
      );

    usados.add(novoId);
    idsMapas.set(
      mapa.id,
      novoId
    );
  }

  const mapas =
    pacote.mapas.map(
      bruto => {
        const mapa =
          normalizarEstruturaMapa(
            clone(bruto)
          );

        for (const objeto of mapa.objetos || []) {
          if (objeto.relacaoOrigemId) objeto.relacaoOrigemMapaId ||= bruto.id;
          if (objeto.relacaoDestinoId) objeto.relacaoDestinoMapaId ||= bruto.id;
        }

        mapa.id =
          idsMapas.get(bruto.id);
        mapa.projectId =
          projeto.id;
        mapa.versaoEditor = 12.5;

        return remapearPortaisMapa(
          mapa,
          idsMapas
        );
      }
    );

  return {
    projeto,
    mapas
  };
}

function persistirProjetoImportado(
  importacao
) {
  return new Promise(
    (resolve, reject) => {
      const transacao = transacaoMapas([STORE_PROJETOS]);
      const projetosStore =
        transacao.objectStore(
          STORE_PROJETOS
        );

      importacao.projeto.atualizadoEm =
        new Date().toISOString();
      projetosStore.put(
        importacao.projeto
      );

      for (
        const mapa of
        importacao.mapas
      ) {
        gravarMapaNaTransacao(transacao, mapa);
      }

      transacao.oncomplete =
        () => resolve();
      transacao.onerror =
        () => reject(transacao.error);
      transacao.onabort =
        () => reject(
          transacao.error ||
          new Error(
            "Não foi possível importar o projeto."
          )
        );
    }
  );
}

async function importarProjetoCompleto(
  pacote
) {
  const idsExistentes =
    (await dbListarResumosMapas(true))
      .map(mapa => mapa.id);
  const importacao =
    prepararProjetoImportado(
      pacote,
      idsExistentes
    );
  const problemas = verificarVinculosMapas(importacao.mapas);

  await persistirProjetoImportado(
    importacao
  );
  await abrirProjeto(
    importacao.projeto.id
  );

  const quantidadeObjetos =
    importacao.mapas.reduce(
      (total, mapa) =>
        total +
        (mapa.objetos?.length || 0),
      0
    );

  avisar(
    `Projeto importado com ${importacao.mapas.length} mapa(s) e ${quantidadeObjetos} objeto(s).` +
    (problemas.length ? ` Atenção: ${problemas.length} vínculo(s) quebrado(s). Use Verificar vínculos do projeto.` : "")
  );
}

async function importarMapaLegado(
  bruto
) {
  if (
    !projetoAtual ||
    !bruto?.nome ||
    !bruto?.imagem
  ) {
    throw new Error(
      "Backup de mapa inválido."
    );
  }

  const migrado =
    normalizarEstruturaMapa(
      bruto
    );
  const ids =
    new Set(
      (await dbListarResumosMapas(true))
        .map(mapa => mapa.id)
    );

  migrado.id =
    idUnico(
      migrado.nome,
      ids
    );
  if (bruto.id) {
    for (const obj of migrado.objetos || []) {
      if (obj.relacaoOrigemId) obj.relacaoOrigemMapaId ||= bruto.id;
      if (obj.relacaoDestinoId) obj.relacaoDestinoMapaId ||= bruto.id;
    }
    remapearPortaisMapa(migrado, new Map([[bruto.id, migrado.id]]));
  }
  migrado.projectId =
    projetoAtual.id;

  await dbSalvar(migrado);
  finalizarHistoricoGlobalPendente();
  await abrirMapa(migrado.id);
  avisar(
    "Mapa importado de um backup antigo."
  );
}

async function importarBackupArquivo(file) {
  try {
    const bruto =
      JSON.parse(
        await file.text()
      );

    if (
      bruto?.formato ===
      "atlas-studio-project"
    ) {
      await importarProjetoCompleto(
        bruto
      );
    } else {
      await importarMapaLegado(
        bruto
      );
    }
  } catch (erro) {
    avisar(
      erro instanceof SyntaxError
        ? "O arquivo não contém um backup JSON válido."
        : erro.message
    );
    return false;
  }

  return true;
}
