const AppError = require("../utils/AppError");
const env = require("../config/env");

/** Contadores diários em memória (v1). Chave alinhada ao BACKEND.md. */
const counters = new Map();

const KINDS = {
  parse: "parse",
  chat: "chat",
};

function dayStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function limitFor(kind) {
  if (kind === KINDS.chat) return Number(env.AI_CHAT_DAILY_LIMIT) || 0;
  return Number(env.AI_PARSE_DAILY_LIMIT) || 0;
}

function counterKey(userId, kind, day = dayStamp()) {
  return `ai:${kind}:${userId}:${day}`;
}

function messageFor(kind, limit) {
  if (kind === KINDS.chat) {
    return `Você atingiu o limite diário do assistente (${limit} mensagens). Tente novamente amanhã.`;
  }
  return `Você atingiu o limite diário de interpretações (${limit}: texto e foto). Tente novamente amanhã.`;
}

function getCount(key) {
  return counters.get(key) || 0;
}

/**
 * Consome 1 unidade da cota diária do usuário para o tipo informado.
 * @param {string} userId
 * @param {"parse"|"chat"} kind
 * @returns {{ limit: number, used: number, remaining: number|null, day: string }}
 */
function consume(userId, kind) {
  const normalized = kind === KINDS.chat ? KINDS.chat : KINDS.parse;
  const limit = limitFor(normalized);
  const day = dayStamp();

  if (limit <= 0) {
    return { limit: 0, used: 0, remaining: null, day, disabled: true };
  }

  const key = counterKey(userId, normalized, day);
  const used = getCount(key);

  if (used >= limit) {
    throw new AppError(messageFor(normalized, limit), 429, {
      code: "ai_daily_limit",
      kind: normalized,
      limit,
      used,
      day,
    });
  }

  const next = used + 1;
  counters.set(key, next);

  return {
    limit,
    used: next,
    remaining: Math.max(limit - next, 0),
    day,
    disabled: false,
  };
}

/** Só consulta (testes / debug). */
function peek(userId, kind) {
  const normalized = kind === KINDS.chat ? KINDS.chat : KINDS.parse;
  const limit = limitFor(normalized);
  const day = dayStamp();
  const used = getCount(counterKey(userId, normalized, day));
  return {
    limit,
    used,
    remaining: limit <= 0 ? null : Math.max(limit - used, 0),
    day,
  };
}

/** Reseta contadores (testes). */
function resetAll() {
  counters.clear();
}

const AiRateLimitService = {
  KINDS,
  consume,
  peek,
  resetAll,
  dayStamp,
};

module.exports = AiRateLimitService;
