const StockOutService = require("./StockOutService");
const IntakeService = require("./IntakeService");
const ShoppingListService = require("./ShoppingListService");
const FinanceService = require("./FinanceService");
const { buildChatContext, answerFromContext } = require("./ChatContextService");
const { formatBRLAmount } = require("../utils/money");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "answer",
      description:
        "Responde perguntas factuais sobre estoque, lista ou situação geral usando só os dados do app. Use para 'quanto tenho de X', 'o que está acabando', etc.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "Pergunta do usuário em português",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_stock_out",
      description:
        "Propõe uma baixa de estoque a partir de texto livre. Cria um rascunho (draft) para o usuário revisar no preview — não confirma a baixa.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "Texto descrevendo o consumo, ex.: 'dê baixa em 1 leite e 200g de queijo'",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_intake",
      description:
        "Propõe uma compra/entrada de estoque a partir de texto livre. Cria um rascunho (draft) com source chat para o usuário revisar no preview — não confirma nem altera estoque.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "Texto descrevendo a compra, ex.: 'comprei 2kg de arroz e 1 leite'",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_shopping_list",
      description:
        "Propõe itens para a lista de compras com regras do estoque (baixos, zerados). Não grava a lista — o usuário confirma no card/CTA.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["rules"],
            description: "Modo de geração (apenas rules nesta versão)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finance_tip",
      description:
        "Retorna resumo de gastos do mês e dicas financeiras do app (mesma base da tela Financeiro). Só leitura — sem mutação.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Ano opcional" },
          month: { type: "integer", description: "Mês 1–12 opcional" },
        },
      },
    },
  },
];

function parseToolArgs(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Monta payload de proposta de entrada (puro — fácil de testar).
 * @param {object} intake — IntakeDetailDto
 */
function buildProposeIntakePayload(intake) {
  const items = intake?.items || [];
  return {
    type: "intake_draft",
    tool: "propose_intake",
    intakeId: intake.id,
    path: `/entrada/${intake.id}/preview`,
    cta: "review_intake",
    requiresReview: true,
    status: intake.status || "draft",
    source: intake.source || "chat",
    itemCount: items.length,
    items: items.slice(0, 8).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    })),
  };
}

async function runAnswer(userId, args = {}) {
  const question = String(args.question || "").trim() || "resumo";
  const context = await buildChatContext(userId);
  const content = answerFromContext(question, context);
  return {
    content,
    payload: {
      type: "answer",
      tool: "answer",
      contextStats: context.stats,
    },
  };
}

async function runProposeStockOut(userId, args = {}) {
  const text = String(args.text || "").trim();
  if (text.length < 3) {
    return {
      content:
        "Para propor uma baixa, descreva o que foi consumido (ex.: dê baixa em 1 leite).",
      payload: { type: "answer", tool: "propose_stock_out", error: "text_required" },
    };
  }

  try {
    const stockOut = await StockOutService.parseNaturalLanguage(userId, text);
    const items = stockOut.items || [];
    const names = items
      .slice(0, 5)
      .map((item) => `${item.quantity} ${item.unit || "un"} ${item.name}`)
      .join(", ");
    const extra = items.length > 5 ? ` e mais ${items.length - 5}` : "";

    return {
      content: items.length
        ? `Montei um rascunho de baixa com ${items.length} item(ns): ${names}${extra}. Revise antes de confirmar.`
        : "Criei um rascunho de baixa, mas não há itens para revisar.",
      payload: {
        type: "stock_out_draft",
        tool: "propose_stock_out",
        stockOutId: stockOut.id,
        path: `/baixa/${stockOut.id}/preview`,
        requiresReview: true,
        itemCount: items.length,
        items: items.slice(0, 8).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
      },
    };
  } catch (err) {
    logger.warn("propose_stock_out falhou", { message: err.message });
    return {
      content:
        err.message ||
        "Não consegui montar a baixa. Tente pela tela Baixa ou reformule os itens.",
      payload: {
        type: "answer",
        tool: "propose_stock_out",
        error: "parse_failed",
        statusCode: err instanceof AppError ? err.statusCode : undefined,
      },
    };
  }
}

async function runProposeIntake(userId, args = {}) {
  const text = String(args.text || "").trim();
  if (text.length < 3) {
    return {
      content:
        "Para propor uma compra, descreva o que entrou (ex.: comprei 2kg de arroz e 1 leite).",
      payload: { type: "answer", tool: "propose_intake", error: "text_required" },
    };
  }

  try {
    const intake = await IntakeService.parseFromChat(userId, text);
    const items = intake.items || [];
    const names = items
      .slice(0, 5)
      .map((item) => `${item.quantity} ${item.unit || "un"} ${item.name}`)
      .join(", ");
    const extra = items.length > 5 ? ` e mais ${items.length - 5}` : "";

    return {
      content: items.length
        ? `Montei um rascunho de compra com ${items.length} item(ns): ${names}${extra}. Revise no preview — o estoque só muda depois que você confirmar.`
        : "Criei um rascunho de compra, mas não há itens para revisar.",
      payload: buildProposeIntakePayload(intake),
    };
  } catch (err) {
    logger.warn("propose_intake falhou", {
      message: err.message,
      statusCode: err.statusCode,
    });
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    return {
      content:
        err.message ||
        "Não consegui montar a compra. Tente pela tela Entrada ou reformule os itens.",
      payload: {
        type: "answer",
        tool: "propose_intake",
        error: statusCode === 503 ? "ai_unavailable" : "parse_failed",
        statusCode,
      },
    };
  }
}

async function runProposeShoppingList(userId, args = {}) {
  const mode = args.mode === "rules" || !args.mode ? "rules" : "rules";
  try {
    const preview = await ShoppingListService.previewSuggestions(userId, { mode });
    const newItems = preview.newSuggestions || [];
    const names = newItems.slice(0, 8).map((item) => item.name);
    const pendingNames = preview.pendingNames || [];

    let content;
    if (newItems.length > 0) {
      content = `Sugeri ${newItems.length} item(ns) para a lista: ${names.join(", ")}${
        newItems.length > 8 ? "…" : ""
      }. Salve para aplicar — nada foi gravado ainda.`;
    } else if (preview.pendingCount > 0) {
      content = `Não há itens novos pelas regras agora. Sua lista já tem ${preview.pendingCount} pendente(s): ${pendingNames.join(", ") || "—"}.`;
    } else {
      content = "Pelas regras do estoque, não há sugestões novas para a lista no momento.";
    }

    return {
      content,
      payload: {
        type: "shopping_list_proposal",
        tool: "propose_shopping_list",
        path: "/lista-compras",
        requiresSave: newItems.length > 0,
        mode,
        itemCount: newItems.length,
        pendingCount: preview.pendingCount,
        items: newItems.slice(0, 8).map((item) => ({
          name: item.name,
          quantity: item.suggestedQty,
          unit: item.unit,
        })),
        itemNames: names,
      },
    };
  } catch (err) {
    logger.warn("propose_shopping_list falhou", { message: err.message });
    return {
      content: err.message || "Não consegui montar a sugestão de lista. Tente em Lista de compras.",
      payload: {
        type: "answer",
        tool: "propose_shopping_list",
        error: "generate_failed",
      },
    };
  }
}

async function runFinanceTip(userId, args = {}) {
  try {
    const [summary, tipsPayload] = await Promise.all([
      FinanceService.getSummary(userId),
      FinanceService.getTips(userId, {
        year: args.year,
        month: args.month,
      }),
    ]);

    const month = summary?.month;
    const tips = tipsPayload?.tips || [];
    const tipText = tips[0]?.message;

    let content = month
      ? `Neste mês você gastou R$ ${formatBRLAmount(month.total)} (${month.count} compra(s)).`
      : "Ainda não há resumo financeiro disponível.";

    if (month?.previousTotal > 0) {
      content += ` Mês anterior: R$ ${formatBRLAmount(month.previousTotal)} (${month.deltaPercent >= 0 ? "+" : ""}${month.deltaPercent}%).`;
    }
    if (month?.projectedTotal > 0) {
      content += ` Projeção: R$ ${formatBRLAmount(month.projectedTotal)}.`;
    }
    if (tipText) content += ` ${tipText}`;

    return {
      content,
      payload: {
        type: "finance_tip",
        tool: "finance_tip",
        path: "/financeiro",
        requiresReview: false,
        month: month
          ? {
              total: month.total,
              count: month.count,
              previousTotal: month.previousTotal,
              deltaPercent: month.deltaPercent,
              projectedTotal: month.projectedTotal,
            }
          : null,
        tips: tips.map((tip) => ({
          id: tip.id,
          severity: tip.severity,
          message: tip.message,
        })),
      },
    };
  } catch (err) {
    logger.warn("finance_tip falhou", { message: err.message });
    return {
      content: err.message || "Não consegui ler o financeiro agora.",
      payload: { type: "answer", tool: "finance_tip", error: "finance_failed" },
    };
  }
}

const EXECUTORS = {
  answer: runAnswer,
  propose_stock_out: runProposeStockOut,
  propose_intake: runProposeIntake,
  propose_shopping_list: runProposeShoppingList,
  finance_tip: runFinanceTip,
};

async function executeTool(userId, name, args = {}) {
  const runner = EXECUTORS[name];
  if (!runner) {
    return {
      content: "Não reconheci essa ação.",
      payload: { type: "answer", tool: name, error: "unknown_tool" },
    };
  }
  return runner(userId, args || {});
}

/**
 * Escolhe tool sem LLM (fallback / sem API key).
 */
function inferToolFromMessage(message) {
  const q = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  if (
    /\b(baixa|baixar|usei|consumi|consumir|dei baixa|dar baixa|de baixa)\b/.test(q) ||
    /\bde\s+baixa\b/.test(q)
  ) {
    return { name: "propose_stock_out", args: { text: message } };
  }

  if (
    /\b(lista|preciso comprar|o que (eu )?preciso|gerar lista|sugest)\b/.test(q)
  ) {
    return { name: "propose_shopping_list", args: { mode: "rules" } };
  }

  if (
    /\b(comprei|compramos|comprou|compra de|registrar compra|adicionei|adicionar (ao|no) estoque|entrada de|entrou|recebi)\b/.test(
      q,
    ) ||
    /\b(registre|registrar)\s+(a\s+)?compra\b/.test(q)
  ) {
    return { name: "propose_intake", args: { text: message } };
  }

  if (/\b(gast|financ|dica|orcament|orçament|projec|quanto\s+(foi|saiu))\b/.test(q)) {
    return { name: "finance_tip", args: {} };
  }

  return { name: "answer", args: { question: message } };
}

const ChatToolsService = {
  definitions: TOOL_DEFINITIONS,
  executeTool,
  inferToolFromMessage,
  parseToolArgs,
  buildProposeIntakePayload,
};

module.exports = ChatToolsService;
