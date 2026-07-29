import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";

const AppError = require("../src/utils/AppError");
const ChatToolsService = require("../src/services/ChatToolsService");
const IntakeService = require("../src/services/IntakeService");

const { inferToolFromMessage, buildProposeIntakePayload, definitions } =
  ChatToolsService;

// tool registrada nas definitions
{
  const names = definitions.map((d) => d.function.name);
  assert.ok(names.includes("propose_intake"));
  assert.ok(names.includes("propose_stock_out"));
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

// payload de proposta: draft + CTA, sem confirmar
{
  const payload = buildProposeIntakePayload({
    id: "intake-1",
    status: "draft",
    source: "chat",
    items: [
      { name: "Arroz", quantity: 2, unit: "kg" },
      { name: "Leite", quantity: 1, unit: "l" },
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

// executeTool com stub: proposta draft, sem confirmar estoque
{
  const original = IntakeService.parseFromChat;
  IntakeService.parseFromChat = async () => ({
    id: "draft-99",
    status: "draft",
    source: "chat",
    items: [{ name: "Feijão", quantity: 1, unit: "kg" }],
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
    assert.match(result.content, /rascunho|revis/i);
  } finally {
    IntakeService.parseFromChat = original;
  }
}

console.log("proposeIntake.test.mjs: ok");
