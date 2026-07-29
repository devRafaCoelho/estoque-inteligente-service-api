import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";

const AppError = require("../src/utils/AppError");
const ChatToolsService = require("../src/services/ChatToolsService");
const IntakeService = require("../src/services/IntakeService");
const IntakeConfirmService = require("../src/services/IntakeConfirmService");
const AiRateLimitService = require("../src/services/AiRateLimitService");
const aiRateLimit = require("../src/middlewares/aiRateLimit");
const {
  LOW_CONFIDENCE_THRESHOLD,
  isLowConfidence,
  summarizeIntakeConfidence,
} = require("../src/utils/intakeConfidence");

const { inferToolFromMessage, buildProposeIntakePayload, definitions } =
  ChatToolsService;

// tool registrada nas definitions
{
  const names = definitions.map((d) => d.function.name);
  assert.ok(names.includes("propose_intake"));
  assert.ok(names.includes("propose_stock_out"));
}

// ChatToolsService não importa/confirm via IntakeConfirmService
{
  const source = readFileSync(
    join(__dirname, "../src/services/ChatToolsService.js"),
    "utf8",
  );
  assert.equal(source.includes("IntakeConfirmService"), false);
  assert.equal(source.includes(".confirm("), false);
}

// heurística: compra → propose_intake
{
  const inferred = inferToolFromMessage("comprei 2kg de arroz e 1 leite");
  assert.equal(inferred.name, "propose_intake");
  assert.match(inferred.args.text, /comprei/i);
}

// heurística: baixa continua stock_out
{
  const inferred = inferToolFromMessage("dê baixa em 1 leite");
  assert.equal(inferred.name, "propose_stock_out");
}

// heurística: lista (não vira intake)
{
  const inferred = inferToolFromMessage("o que eu preciso comprar?");
  assert.equal(inferred.name, "propose_shopping_list");
}

// payload: draft + CTA + flags de confiança
{
  const payload = buildProposeIntakePayload({
    id: "intake-1",
    status: "draft",
    source: "chat",
    items: [
      { name: "Arroz", quantity: 2, unit: "kg", confidence: 0.9 },
      { name: "Leite", quantity: 1, unit: "l", confidence: 0.55 },
    ],
  });
  assert.equal(payload.type, "intake_draft");
  assert.equal(payload.tool, "propose_intake");
  assert.equal(payload.intakeId, "intake-1");
  assert.equal(payload.status, "draft");
  assert.equal(payload.source, "chat");
  assert.equal(payload.cta, "review_intake");
  assert.equal(payload.requiresReview, true);
  assert.equal(payload.path, "/entrada/intake-1/preview");
  assert.equal(payload.itemCount, 2);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.hasLowConfidenceItems, true);
  assert.equal(payload.lowConfidenceCount, 1);
  assert.equal(payload.items[0].lowConfidence, false);
  assert.equal(payload.items[1].lowConfidence, true);
  assert.equal(payload.items[1].confidence, 0.55);
}

// item de baixa confiança permanece no draft (marcado, não removido)
{
  const summary = summarizeIntakeConfidence([
    { name: "Ambíguo", quantity: 1, unit: "un", confidence: 0.55 },
    { name: "Claro", quantity: 2, unit: "kg", confidence: 0.92 },
  ]);
  assert.equal(summary.items.length, 2);
  assert.equal(summary.lowConfidenceCount, 1);
  assert.ok(isLowConfidence(0.55));
  assert.equal(isLowConfidence(0.9), false);
  assert.ok(0.55 < LOW_CONFIDENCE_THRESHOLD);
}

// texto curto → erro controlado (sem 500)
{
  const result = await ChatToolsService.executeTool("user-1", "propose_intake", {
    text: "oi",
  });
  assert.equal(result.payload.tool, "propose_intake");
  assert.equal(result.payload.error, "text_required");
  assert.equal(result.payload.type, "answer");
}

// AppError 503 mapeado (simula IA indisponível)
{
  const original = IntakeService.parseFromChat;
  IntakeService.parseFromChat = async () => {
    throw new AppError("Leitura exige IA configurada (AI_API_KEY).", 503);
  };
  try {
    const result = await ChatToolsService.executeTool("user-1", "propose_intake", {
      text: "comprei 1 arroz",
    });
    assert.equal(result.payload.error, "ai_unavailable");
    assert.equal(result.payload.statusCode, 503);
    assert.equal(result.payload.type, "answer");
    assert.ok(result.content);
  } finally {
    IntakeService.parseFromChat = original;
  }
}

// 429 não é engolido pela tool (estilo chat / rate limit)
{
  const original = IntakeService.parseFromChat;
  IntakeService.parseFromChat = async () => {
    throw new AppError("Você atingiu o limite diário do assistente (2 mensagens). Tente novamente amanhã.", 429, {
      code: "ai_daily_limit",
      kind: "chat",
      limit: 2,
      used: 2,
    });
  };
  try {
    let thrown = null;
    try {
      await ChatToolsService.executeTool("user-1", "propose_intake", {
        text: "comprei 1 arroz",
      });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown);
    assert.equal(thrown.statusCode, 429);
    assert.equal(thrown.details?.code, "ai_daily_limit");
    assert.match(thrown.message, /limite diário do assistente/i);
  } finally {
    IntakeService.parseFromChat = original;
  }
}

// rate limit do chat (middleware) aplica antes da tool — estouro = 429
{
  const originalConsume = AiRateLimitService.consume;
  let calls = 0;
  AiRateLimitService.consume = (userId, kind) => {
    assert.equal(kind, "chat");
    calls += 1;
    if (calls > 1) {
      throw new AppError(
        "Você atingiu o limite diário do assistente (1 mensagens). Tente novamente amanhã.",
        429,
        { code: "ai_daily_limit", kind: "chat", limit: 1, used: 1, day: "2026-07-29" },
      );
    }
    return { limit: 1, used: 1, remaining: 0, day: "2026-07-29", disabled: false };
  };

  const mw = aiRateLimit("chat");
  const res = { setHeader() {} };

  try {
    await new Promise((resolve, reject) => {
      mw({ user: { id: "user-propose-intake-rate" } }, res, (err) =>
        err ? reject(err) : resolve(),
      );
    });

    let blocked = null;
    await new Promise((resolve) => {
      mw({ user: { id: "user-propose-intake-rate" } }, res, (err) => {
        blocked = err || null;
        resolve();
      });
    });
    assert.ok(blocked);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.details?.kind, "chat");
    assert.equal(blocked.details?.code, "ai_daily_limit");
    assert.match(blocked.message, /assistente/i);
  } finally {
    AiRateLimitService.consume = originalConsume;
  }
}

// rota de chat usa aiRateLimit("chat") antes de postMessage
{
  const source = readFileSync(join(__dirname, "../src/routes/chatRoutes.js"), "utf8");
  assert.match(source, /aiRateLimit\(\s*["']chat["']\s*\)/);
  assert.match(source, /postMessage/);
}

// executeTool com stub: proposta draft, sem chamar confirm
{
  const originalParse = IntakeService.parseFromChat;
  const originalConfirm = IntakeConfirmService.confirm;
  let confirmCalls = 0;
  IntakeConfirmService.confirm = async () => {
    confirmCalls += 1;
    throw new Error("confirm não deveria ser chamado");
  };
  IntakeService.parseFromChat = async () => ({
    id: "draft-99",
    status: "draft",
    source: "chat",
    items: [
      { name: "Feijão", quantity: 1, unit: "kg", confidence: 0.88 },
      { name: "Algo duvidoso", quantity: 1, unit: "un", confidence: 0.5 },
    ],
  });
  try {
    const result = await ChatToolsService.executeTool("user-1", "propose_intake", {
      text: "comprei 1kg de feijão",
    });
    assert.equal(result.payload.type, "intake_draft");
    assert.equal(result.payload.status, "draft");
    assert.equal(result.payload.intakeId, "draft-99");
    assert.equal(result.payload.cta, "review_intake");
    assert.equal(result.payload.requiresReview, true);
    assert.equal(result.payload.hasLowConfidenceItems, true);
    assert.equal(result.payload.lowConfidenceCount, 1);
    assert.equal(result.payload.items.length, 2);
    assert.equal(result.payload.items[1].lowConfidence, true);
    assert.match(result.content, /baixa confiança|rascunho|revis/i);
    assert.equal(confirmCalls, 0);
  } finally {
    IntakeService.parseFromChat = originalParse;
    IntakeConfirmService.confirm = originalConfirm;
  }
}

console.log("proposeIntake.test.mjs: ok");
