const cheerio = require("cheerio");

const UNIT_MAP = {
  un: "un",
  und: "un",
  unidade: "un",
  unidades: "un",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  g: "g",
  gr: "g",
  grama: "g",
  gramas: "g",
  l: "l",
  lt: "l",
  litro: "l",
  litros: "l",
  ml: "ml",
  pct: "pct",
  pacote: "pct",
  pack: "pct",
  cx: "cx",
  caixa: "cx",
};

function parseNumber(raw) {
  const text = String(raw || "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(raw) {
  const key = String(raw || "un")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return UNIT_MAP[key] || "un";
}

/**
 * Extrai itens de HTML típico de consulta NFC-e (padrão SEFAZ-SP e similares).
 * @param {string} html
 * @returns {{ items: Array<{name:string,quantity:number,unit:string,unitPrice:number|null}>, storeName: string|null }}
 */
function parseNfceHtml(html) {
  const $ = cheerio.load(String(html || ""));
  const items = [];

  // Padrão comum SP: spans .txtTit + .Rqtd + .RUN + .RvlUnit
  const titles = $(".txtTit").toArray();
  if (titles.length) {
    titles.forEach((el, index) => {
      const root = $(el).closest("tr").length ? $(el).closest("tr") : $(el).parent();
      const name = $(el).text().replace(/\s+/g, " ").trim();
      if (!name) return;

      const qtyText =
        root.find(".Rqtd").first().text() ||
        root.find(".qtd").first().text() ||
        "";
      const unitText =
        root.find(".RUN").first().text() ||
        root.find(".un").first().text() ||
        "UN";
      const priceText =
        root.find(".RvlUnit").first().text() ||
        root.find(".valor").first().text() ||
        "";

      const quantity = parseNumber(qtyText.replace(/qtde\.?:?/i, "")) || 1;
      const unit = normalizeUnit(unitText.replace(/un:?/i, "").trim() || "un");
      const unitPrice = parseNumber(priceText.replace(/vl\.?\s*unit\.?:?/i, ""));

      items.push({
        name,
        quantity,
        unit,
        unitPrice: unitPrice != null && unitPrice >= 0 ? unitPrice : null,
        sortOrder: index,
      });
    });
  }

  // Fallback: linhas de tabela com 3+ colunas
  if (!items.length) {
    $("table tr").each((index, tr) => {
      const cells = $(tr)
        .find("td")
        .toArray()
        .map((td) => $(td).text().replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (cells.length < 2) return;
      const name = cells[0];
      if (!name || /^(item|código|descricao|descrição|produto)$/i.test(name)) return;
      if (name.length < 2) return;

      const quantity = parseNumber(cells[1]) || 1;
      const unit = normalizeUnit(cells[2] || "un");
      const unitPrice =
        parseNumber(cells.find((c, i) => i >= 2 && /[\d]/.test(c)) || "") ?? null;

      items.push({
        name,
        quantity,
        unit,
        unitPrice: unitPrice != null && unitPrice >= 0 ? unitPrice : null,
        sortOrder: index,
      });
    });
  }

  const storeName =
    $("#u20").text().trim() ||
    $(".txtTopo").first().text().trim() ||
    $("title").text().trim() ||
    null;

  return {
    items: items.filter((item) => item.name && item.quantity > 0),
    storeName: storeName && storeName.length < 200 ? storeName : null,
  };
}

module.exports = {
  parseNfceHtml,
  parseNumber,
  normalizeUnit,
};
