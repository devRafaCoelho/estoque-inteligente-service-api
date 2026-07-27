const OpenAI = require("openai");
const AppError = require("../utils/AppError");
const env = require("../config/env");
const logger = require("../utils/logger");
const ChatRepository = require("../repositories/ChatRepository");
const { ChatSessionDto, ChatMessageDto } = require("../dto/v1/chatDto");
const { clampLimit } = require("../utils/pagination");

const HISTORY_LIMIT = 40;
const LLM_HISTORY_LIMIT = 12;

const FALLBACK_REPLY =
  "Recebi sua mensagem. Em breve consigo consultar estoque, sugerir lista de compras, propor baixas e dar dicas financeiras por aqui. Por enquanto, use as telas de Entrada, Baixa, Lista e Financeiro — ou continue conversando que eu respondo.";

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

async function generateAssistantReply(historyRows, userMessage) {
  const openai = getClient();
  if (!openai) {
    return {
      content: FALLBACK_REPLY,
      payload: { type: "answer", parser: "fallback" },
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
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `Você é o assistente do app Estoque Inteligente (português do Brasil).
Nesta versão inicial você só conversa: seja breve, amigável e útil.
NÃO invente saldos, preços ou itens do estoque do usuário.
Se pedirem baixa, lista, financeiro ou quantidade em estoque, diga que isso chega em seguida e sugira usar as telas Entrada, Baixa, Lista de compras ou Financeiro por enquanto.
Não use markdown pesado; respostas curtas (2–4 frases).`,
        },
        ...history,
        { role: "user", content: userMessage },
      ],
    });

    const content = String(response.choices?.[0]?.message?.content || "").trim();
    if (!content) {
      return {
        content: FALLBACK_REPLY,
        payload: { type: "answer", parser: "fallback" },
      };
    }

    return {
      content,
      payload: { type: "answer", parser: "gemini" },
    };
  } catch (err) {
    logger.warn("Falha no chat via IA; usando fallback", { message: err.message });
    return {
      content: FALLBACK_REPLY,
      payload: { type: "answer", parser: "fallback" },
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

    const replyDraft = await generateAssistantReply(existing, text);
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
