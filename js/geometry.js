/* Conversão entre pixels e coordenadas do mapa, distâncias e polígonos. */
function pixelParaMapa(x, y) {
  return [
    mapaAtual.altura - y,
    x
  ];
}

function mapaParaPixel(latlng) {
  return {
    x: Math.round(latlng.lng),
    y: Math.round(
      mapaAtual.altura - latlng.lat
    )
  };
}

function calibracaoMedidaValida(calibracao) {
  return Boolean(
    calibracao &&
    Number(calibracao.pixels) > 0 &&
    Number(calibracao.valor) > 0 &&
    String(calibracao.unidade || "").trim()
  );
}

function medidaPorPixel(calibracao = mapaAtual?.calibracaoMedida) {
  if (!calibracaoMedidaValida(calibracao)) {
    return null;
  }

  return Number(calibracao.valor) /
    Number(calibracao.pixels);
}

function medidaMapaParaTela(valor) {
  const a =
    mapa.latLngToLayerPoint(
      pixelParaMapa(0, 0)
    );

  const b =
    mapa.latLngToLayerPoint(
      pixelParaMapa(valor, 0)
    );

  return Math.max(
    0.1,
    Math.abs(b.x - a.x)
  );
}

function clamp(valor, minimo, maximo) {
  return Math.min(
    maximo,
    Math.max(minimo, valor)
  );
}

function pontoDentroPoligono(
  ponto,
  poligono
) {
  let dentro = false;

  for (
    let i = 0,
        j = poligono.length - 1;
    i < poligono.length;
    j = i++
  ) {
    const xi = poligono[i].x;
    const yi = poligono[i].y;
    const xj = poligono[j].x;
    const yj = poligono[j].y;

    const cruza =
      (
        (yi > ponto.y) !==
        (yj > ponto.y)
      ) &&
      (
        ponto.x <
        (
          (xj - xi) *
          (ponto.y - yi)
        ) /
        (
          (yj - yi) ||
          Number.EPSILON
        ) +
        xi
      );

    if (cruza) {
      dentro = !dentro;
    }
  }

  return dentro;
}

function pontoInteriorArea(pontos) {
  // Varredura horizontal: o ponto médio de um intervalo interno também
  // funciona em regiões côncavas, cujo centro da caixa pode cair fora da área.
  const ys = [...new Set(pontos.map(p => Number(p.y)))].sort((a, b) => a - b);
  let melhor = null;
  let largura = 0;
  for (let k = 1; k < ys.length; k++) {
    const y = (ys[k - 1] + ys[k]) / 2;
    const cortes = [];
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i], b = pontos[(i + 1) % pontos.length];
      if ((a.y > y) !== (b.y > y)) {
        cortes.push(Number(a.x) + (y - a.y) * (b.x - a.x) / (b.y - a.y));
      }
    }
    cortes.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cortes.length; i += 2) {
      if (cortes[i + 1] - cortes[i] > largura) {
        largura = cortes[i + 1] - cortes[i];
        melhor = { x: (cortes[i] + cortes[i + 1]) / 2, y };
      }
    }
  }
  return melhor;
}
