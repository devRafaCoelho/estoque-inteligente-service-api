import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

process.env.DATABASE_URL ||= "postgresql://localhost/test";
process.env.JWT_SECRET ||= "test-secret";
process.env.AI_PARSE_DAILY_LIMIT = "3";
process.env.AI_CHAT_DAILY_LIMIT = "2";

const AiRateLimitService = require("../src/services/AiRateLimitService.js");

AiRateLimitService.resetAll();

const userId = "user-rate-limit-test";

{
  const first = AiRateLimitService.consume(userId, "parse");
  assert.equal(first.used, 1);
  assert.equal(first.remaining, 2);

  AiRateLimitService.consume(userId, "parse");
  AiRateLimitService.consume(userId, "parse");

  let blocked = null;
  try {
    AiRateLimitService.consume(userId, "parse");
  } catch (err) {
    blocked = err;
  }
  assert.ok(blocked);
  assert.equal(blocked.statusCode, 429);
  assert.match(blocked.message, /limite diário/i);
  assert.match(blocked.message, /texto e foto/i);
  assert.equal(blocked.details.code, "ai_daily_limit");
  assert.equal(blocked.details.kind, "parse");
}

{
  AiRateLimitService.consume(userId, "chat");
  AiRateLimitService.consume(userId, "chat");
  let blocked = null;
  try {
    AiRateLimitService.consume(userId, "chat");
  } catch (err) {
    blocked = err;
  }
  assert.ok(blocked);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.details.kind, "chat");
}

{
  // Cotas parse e chat são independentes
  const other = "user-other";
  AiRateLimitService.resetAll();
  AiRateLimitService.consume(other, "parse");
  AiRateLimitService.consume(other, "parse");
  AiRateLimitService.consume(other, "parse");
  let parseBlocked = null;
  try {
    AiRateLimitService.consume(other, "parse");
  } catch (err) {
    parseBlocked = err;
  }
  assert.ok(parseBlocked);

  const chatOk = AiRateLimitService.consume(other, "chat");
  assert.equal(chatOk.used, 1);
  assert.equal(chatOk.remaining, 1);
}

{
  // F2-4.3: texto e imagem compartilham a mesma cota "parse"
  // (rotas /intakes/parse-text, /intakes/parse-image e /stock-outs/parse-text)
  const shared = "user-text-image-shared";
  AiRateLimitService.resetAll();
  AiRateLimitService.consume(shared, "parse"); // simula parse-text
  AiRateLimitService.consume(shared, "parse"); // simula parse-image
  const third = AiRateLimitService.consume(shared, "parse"); // simula stock-out parse-text
  assert.equal(third.used, 3);
  assert.equal(third.remaining, 0);

  let blocked = null;
  try {
    AiRateLimitService.consume(shared, "parse");
  } catch (err) {
    blocked = err;
  }
  assert.ok(blocked);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.details.kind, "parse");
  assert.equal(blocked.details.limit, 3);

  const peek = AiRateLimitService.peek(shared, "parse");
  assert.equal(peek.used, 3);
  assert.equal(peek.remaining, 0);
}

console.log("aiRateLimit.test.mjs: ok");
