const ProductRepository = require("../repositories/ProductRepository");
const ShoppingListService = require("./ShoppingListService");
const FinanceService = require("./FinanceService");
const stockStatus = require("../utils/stockStatus");
const { formatBRLAmount } = require("../utils/money");
const logger = require("../utils/logger");

const MAX_PRODUCTS_IN_CONTEXT = 40;
const MAX_LIST_ITEMS = 15;
const MAX_TIPS = 3;
const MAX_CRITICAL_NAMES = 8;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatProductLine(product) {
  const qty = Number(product.quantity);
  const unit = product.unit || "un";
  const status = stockStatus(product.quantity, product.min_quantity);
  const statusLabel =
    status === "out" ? "zerado" : status === "low" ? "baixo" : "ok";
  return `- ${product.name}: ${qty} ${unit} (${statusLabel}; mín. ${Number(product.min_quantity)})`;
}

function statusLabelPt(status) {
  if (status === "out") return "zerado";
  if (status === "low") return "baixo";
  return "ok";
}

function emptyContext() {
  return {
    text: "Sem dados de contexto disponíveis no momento.",
    stats: { ok: 0, low: 0, out: 0, total: 0 },
    finance: null,
    criticalNames: { low: [], out: [] },
    pendingListNames: [],
    tips: [],
    products: [],
  };
}

/**
 * Localiza produto citado na pergunta (ex.: "quanto de arroz eu tenho?").
 */
function findProductInQuestion(question, products = []) {
  if (!products.length) return null;
  const q = normalizeText(question);
  if (!q) return null;

  const sorted = [...products].sort(
    (a, b) => normalizeText(b.name).length - normalizeText(a.name).length,
  );

  for (const product of sorted) {
    const name = normalizeText(product.name);
    if (name.length >= 3 && q.includes(name)) return product;
  }

  for (const product of sorted) {
    const tokens = normalizeText(product.name).split(" ").filter((t) => t.length >= 4);
    for (const token of tokens) {
      if (q.includes(token)) return product;
    }
  }

  const patterns = [
    /quanto(?:s)?\s+de\s+(.+?)(?:\s+eu\s+tenho|\s+ainda|\s+tem|\?|$)/,
    /(?:eu\s+)?tenho(?:\s+de)?\s+(.+?)(?:\s+ainda|\?|$)/,
    /estoque\s+(?:de\s+)?(.+?)(?:\?|$)/,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (!match) continue;
    const needle = normalizeText(match[1]).replace(/\b(eu|tenho|ainda|hoje)\b/g, "").trim();
    if (needle.length < 3) continue;

    for (const product of sorted) {
      const name = normalizeText(product.name);
      if (name.includes(needle) || needle.includes(name.split(" ")[0])) {
        return product;
      }
    }
  }

  return null;
}

function formatProductAnswer(product) {
  const qty = Number(product.quantity);
  const unit = product.unit || "un";
  const status = product.status || stockStatus(product.quantity, product.minQuantity);
  const prettyQty = Number.isInteger(qty) ? String(qty) : String(qty);
  const label = statusLabelPt(status);

  if (status === "out") {
    return `Você está sem ${product.name} no estoque (0 ${unit}).`;
  }
  if (status === "low") {
    return `Você tem ${prettyQty} ${unit} de ${product.name} — estoque baixo (mínimo ${product.minQuantity} ${unit}).`;
  }
  return `Você tem ${prettyQty} ${unit} de ${product.name} no estoque (${label}).`;
}

/**
 * Monta snapshot textual + estruturado para o chat.
 * Fonte única de verdade: serviços/repos existentes (não inventa saldos).
 */
async function buildChatContext(userId) {
  try {
    const [products, listDetail, finance, tipsPayload] = await Promise.all([
      ProductRepository.list(userId, { active: true }),
      ShoppingListService.getActive(userId).catch(() => null),
      FinanceService.getSummary(userId).catch(() => null),
      FinanceService.getTips(userId).catch(() => null),
    ]);

    let ok = 0;
    let low = 0;
    let out = 0;
    const ranked = [];
    const lowNames = [];
    const outNames = [];
    const catalog = [];

    for (const product of products || []) {
      const status = stockStatus(product.quantity, product.min_quantity);
      const entry = {
        id: product.id,
        name: product.name,
        quantity: Number(product.quantity),
        unit: product.unit || "un",
        minQuantity: Number(product.min_quantity),
        status,
      };
      catalog.push(entry);

      if (status === "ok") ok += 1;
      else if (status === "low") {
        low += 1;
        lowNames.push(product.name);
      } else {
        out += 1;
        outNames.push(product.name);
      }
      ranked.push({ product, status, qty: Number(product.quantity) });
    }

    ranked.sort((a, b) => {
      const rank = { out: 0, low: 1, ok: 2 };
      return rank[a.status] - rank[b.status] || a.qty - b.qty;
    });

    const productLines = ranked
      .slice(0, MAX_PRODUCTS_IN_CONTEXT)
      .map((row) => formatProductLine(row.product));

    const pendingItems = (listDetail?.items || []).filter((item) => !item.checked);
    const listItems = pendingItems.slice(0, MAX_LIST_ITEMS).map((item) => {
      const qty =
        item.suggestedQty != null ? `${item.suggestedQty} ${item.unit || "un"}` : "";
      return qty ? `- ${item.name} (${qty})` : `- ${item.name}`;
    });

    const month = finance?.month || null;
    const financeLines = month
      ? [
          `- Gasto do mês: R$ ${formatBRLAmount(month.total)} (${month.count} compra(s))`,
          `- Mês anterior: R$ ${formatBRLAmount(month.previousTotal)} (delta ${month.deltaPercent}%)`,
          `- Projeção do mês: R$ ${formatBRLAmount(month.projectedTotal)}`,
        ]
      : ["- Sem dados financeiros."];

    const topCategories = (finance?.byCategory || []).slice(0, 3).map((row) => {
      return `- ${row.category}: R$ ${formatBRLAmount(row.total)}`;
    });

    const tips = (tipsPayload?.tips || []).slice(0, MAX_TIPS);
    const tipLines = tips.map((tip) => `- ${tip.message}`);

    const sections = [
      "## Estoque (produtos ativos)",
      `Resumo: ${ok} ok, ${low} baixo, ${out} zerado (total ${products.length}).`,
      productLines.length
        ? productLines.join("\n")
        : "- Nenhum produto ativo cadastrado.",
      products.length > MAX_PRODUCTS_IN_CONTEXT
        ? `(… +${products.length - MAX_PRODUCTS_IN_CONTEXT} produtos omitidos; priorize out/low acima)`
        : null,
      "",
      "## Lista de compras (pendentes)",
      listItems.length ? listItems.join("\n") : "- Lista vazia ou sem itens pendentes.",
      "",
      "## Financeiro (mês atual)",
      ...financeLines,
      topCategories.length ? "Top categorias:" : null,
      ...topCategories,
      tipLines.length ? "Dicas:" : null,
      ...tipLines,
    ].filter((line) => line != null);

    return {
      text: sections.join("\n"),
      stats: { ok, low, out, total: products.length },
      finance: month
        ? {
            total: Number(month.total) || 0,
            count: month.count || 0,
            previousTotal: Number(month.previousTotal) || 0,
            deltaPercent: month.deltaPercent,
            projectedTotal: Number(month.projectedTotal) || 0,
          }
        : null,
      criticalNames: {
        low: lowNames.slice(0, MAX_CRITICAL_NAMES),
        out: outNames.slice(0, MAX_CRITICAL_NAMES),
      },
      pendingListNames: pendingItems
        .slice(0, MAX_LIST_ITEMS)
        .map((item) => item.name),
      tips: tips.map((tip) => tip.message),
      products: catalog,
    };
  } catch (err) {
    logger.warn("Falha ao montar contexto do chat", { message: err.message });
    return emptyContext();
  }
}

/**
 * Resposta determinística a partir do contexto (quando a IA falha ou tool answer).
 */
function answerFromContext(userMessage, context) {
  const q = normalizeText(userMessage);
  const stats = context?.stats || { ok: 0, low: 0, out: 0, total: 0 };
  const finance = context?.finance;
  const lowNames = context?.criticalNames?.low || [];
  const outNames = context?.criticalNames?.out || [];
  const pending = context?.pendingListNames || [];
  const tips = context?.tips || [];
  const products = context?.products || [];

  const matchedProduct = findProductInQuestion(userMessage, products);
  if (matchedProduct) {
    return formatProductAnswer(matchedProduct);
  }

  const asksFinance =
    /gast|financ|compr(a|ei|as)|quanto\s+(foi|saiu)|mes\b|orcament|projec/.test(q);
  const asksCritical =
    /acaband|zerad|baixo|faltand|em atencao|critico|urgenc/.test(q);
  const asksStockOverview =
    asksCritical ||
    (/estoque|produt/.test(q) && !/quanto\s+de\b/.test(q));
  const asksList = /lista|comprar|preciso\s+compr/.test(q);

  if (asksFinance && finance) {
    let reply = `Neste mês você gastou R$ ${formatBRLAmount(finance.total)}`;
    reply +=
      finance.count === 1
        ? " em 1 compra."
        : ` em ${finance.count} compra(s).`;
    if (finance.previousTotal > 0) {
      reply += ` No mês anterior foram R$ ${formatBRLAmount(finance.previousTotal)}`;
      reply += ` (${finance.deltaPercent >= 0 ? "+" : ""}${finance.deltaPercent}%).`;
    }
    if (finance.projectedTotal > 0) {
      reply += ` Na projeção atual, o mês fecha em torno de R$ ${formatBRLAmount(finance.projectedTotal)}.`;
    }
    if (tips[0]) reply += ` ${tips[0]}`;
    return reply;
  }

  if (asksList) {
    if (!pending.length) {
      return "Sua lista de compras não tem itens pendentes no momento.";
    }
    const names = pending.slice(0, 8).join(", ");
    const extra = pending.length > 8 ? ` e mais ${pending.length - 8}` : "";
    return `Na lista pendente: ${names}${extra}.`;
  }

  if (asksStockOverview) {
    const parts = [];
    if (outNames.length) {
      parts.push(`${outNames.length} zerado(s): ${outNames.join(", ")}`);
    }
    if (lowNames.length) {
      parts.push(`${lowNames.length} baixo(s): ${lowNames.join(", ")}`);
    }
    if (!parts.length) {
      return `Seu estoque está em dia: ${stats.ok} produto(s) ok, nenhum baixo ou zerado.`;
    }
    return `Atenção no estoque — ${parts.join("; ")}. Resumo: ${stats.ok} ok, ${stats.low} baixo, ${stats.out} zerado.`;
  }

  if (finance) {
    return `Posso falar do seu estoque (${stats.ok} ok, ${stats.low} baixo, ${stats.out} zerado), da lista de compras ou dos gastos (R$ ${formatBRLAmount(finance.total)} neste mês). O que você quer saber?`;
  }

  return `Posso falar do seu estoque (${stats.ok} ok, ${stats.low} baixo, ${stats.out} zerado) ou da lista de compras. O que você quer saber?`;
}

module.exports = {
  buildChatContext,
  answerFromContext,
  findProductInQuestion,
};
