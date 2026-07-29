const OpenAI = require("openai");
const AppError = require("../utils/AppError");
const env = require("../config/env");
const logger = require("../utils/logger");
const ChatRepository = require("../repositories/ChatRepository");
const { buildChatContext } = require("./ChatContextService");
const ChatToolsService = require("./ChatToolsService");
const { ChatSessionDto, ChatMessageDto } = require("../dto/v1/chatDto");
const { clampLimit } = require("../utils/pagination");

const HISTORY_LIMIT = 40;
const LLM_HISTORY_LIMIT = 12;

let client;

function isAiConfigured() {
  return Boolean(env.AI_API_KEY);
}

function getClient() {
  if (!isAiConfigured()) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
    });
  }
  return client;
}

function titleFromMessage(text) {
  const clean = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!clean) return "Nova conversa";
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

function buildSystemPrompt(contextText) {
  return `Você é o assistente do app Estoque Inteligente (português do Brasil).
Escolha UMA tool adequada à intenção do usuário:
- answer: perguntas factuais (estoque, quantidades, o que está acabando)
- propose_stock_out: usuário quer registrar consumo/baixa
- propose_intake: usuário quer registrar compra/entrada no estoque
- propose_shopping_list: usuário quer saber o que comprar — propõe itens; só grava após CTA
- finance_tip: gastos do mês, dicas financeiras

REGRAS:
- Prefira tools em vez de inventar números.
- Use só o contexto abaixo como verdade; não invente saldos.
- Para baixa, passe o texto completo do usuário em propose_stock_out.text.
- Para compra/entrada, passe o texto completo em propose_intake.text.
- Propostas mutáveis sempre passam por card/CTA de revisão (nunca confirme estoque no chat).

Contexto atual do usuário:
${contextText}`;
}

function extractLlmText(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) return "";
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  return "";
}

function extractToolCalls(response) {
  const message = response?.choices?.[0]?.message;
  const calls = message?.tool_calls;
  if (!Array.isArray(calls) || !calls.length) return [];
  return calls
    .map((call) => ({
      id: call.id,
      name: call.function?.name || call.name,
      args: ChatToolsService.parseToolArgs(call.function?.arguments ?? call.arguments),
    }))
    .filter((call) => call.name);
}

async function runInferredTool(userId, userMessage) {
  const inferred = ChatToolsService.inferToolFromMessage(userMessage);
  return ChatToolsService.executeTool(userId, inferred.name, inferred.args);
}

async function generateAssistantReply(userId, historyRows, userMessage) {
  const context = await buildChatContext(userId);
  const openai = getClient();

  if (!openai) {
    const result = await runInferredTool(userId, userMessage);
    return {
      ...result,
      payload: {
        ...result.payload,
        parser: "tools_heuristic",
        contextStats: context.stats,
      },
    };
  }

  const history = historyRows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .slice(-LLM_HISTORY_LIMIT)
    .map((row) => ({
      role: row.role,
      content: row.content,
    }));

  try {
    const response = await openai.chat.completions.create({
      model: env.AI_MODEL,
      temperature: 0.1,
      max_tokens: 400,
      tools: ChatToolsService.definitions,
      tool_choice: "auto",
      messages: [
        { role: "system", content: buildSystemPrompt(context.text) },
        ...history,
        { role: "user", content: userMessage },
      ],
    });

    const toolCalls = extractToolCalls(response);
    if (toolCalls.length) {
      const primary = toolCalls[0];
      const result = await ChatToolsService.executeTool(
        userId,
        primary.name,
        primary.args,
      );
      return {
        ...result,
        payload: {
          ...result.payload,
          parser: "tools_gemini",
          contextStats: context.stats,
        },
      };
    }

    const content = extractLlmText(response);
    if (content) {
      return {
        content,
        payload: {
          type: "answer",
          tool: "answer",
          parser: "gemini",
          contextStats: context.stats,
        },
      };
    }

    logger.warn("Chat IA sem tool e sem texto; usando heurística de tools");
    const fallback = await runInferredTool(userId, userMessage);
    return {
      ...fallback,
      payload: {
        ...fallback.payload,
        parser: "tools_heuristic",
        contextStats: context.stats,
      },
    };
  } catch (err) {
    logger.warn("Falha no chat via IA; usando heurística de tools", {
      message: err.message,
      status: err.status,
      code: err.code,
    });
    const fallback = await runInferredTool(userId, userMessage);
    return {
      ...fallback,
      payload: {
        ...fallback.payload,
        parser: "tools_heuristic",
        contextStats: context.stats,
      },
    };
  }
}

const ChatService = {
  async getCurrentSession(userId) {
    let session = await ChatRepository.findLatest(userId);
    if (!session) {
      session = await ChatRepository.create(userId, { title: "Nova conversa" });
    }
    const messages = await ChatRepository.listMessages(session.id, {
      limit: HISTORY_LIMIT,
    });
    return {
      session: ChatSessionDto(session),
      messages: messages.map(ChatMessageDto),
    };
  },

  async postMessage(userId, { message, sessionId = null }) {
    const text = String(message || "").trim();
    if (!text) {
      throw new AppError("Informe uma mensagem", 422);
    }

    let session = null;
    if (sessionId) {
      session = await ChatRepository.findById(userId, sessionId);
      if (!session) {
        throw new AppError("Conversa não encontrada", 404);
      }
    } else {
      session = await ChatRepository.findLatest(userId);
      if (!session) {
        session = await ChatRepository.create(userId, {
          title: titleFromMessage(text),
        });
      }
    }

    const existing = await ChatRepository.listMessages(session.id, {
      limit: HISTORY_LIMIT,
    });

    const userRow = await ChatRepository.createMessage({
      sessionId: session.id,
      role: "user",
      content: text,
      payload: {},
    });

    if (!session.title || session.title === "Nova conversa") {
      session = await ChatRepository.touch(session.id, {
        title: titleFromMessage(text),
      });
    } else {
      session = await ChatRepository.touch(session.id);
    }

    const replyDraft = await generateAssistantReply(userId, existing, text);
    const assistantRow = await ChatRepository.createMessage({
      sessionId: session.id,
      role: "assistant",
      content: replyDraft.content,
      payload: replyDraft.payload,
    });

    const messages = await ChatRepository.listMessages(session.id, {
      limit: clampLimit(HISTORY_LIMIT, { min: 1, max: 100, fallback: HISTORY_LIMIT }),
    });

    return {
      session: ChatSessionDto(session),
      messages: messages.map(ChatMessageDto),
      reply: ChatMessageDto(assistantRow),
      userMessage: ChatMessageDto(userRow),
    };
  },
};

module.exports = ChatService;
