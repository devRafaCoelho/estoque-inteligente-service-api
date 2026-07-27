import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeStateCode,
  parseNfQrInput,
} = require("../src/services/nf/NfUrlParser.js");

/** Chave NF-e SP válida (modelo 55) — dígito verificador conferido. */
const SP_KEY =
  "35240114200166000187550010000000111000000113";

test("normalizeStateCode aceita UF válida", () => {
  assert.equal(normalizeStateCode("sp"), "SP");
  assert.equal(normalizeStateCode(" MG "), "MG");
  assert.equal(normalizeStateCode(""), null);
  assert.equal(normalizeStateCode("SPO"), null);
});

test("parseNfQrInput: UF da chave prevalece sobre body.stateCode (scan sobrescreve preferência)", () => {
  const result = parseNfQrInput({
    accessKey: SP_KEY,
    stateCode: "MG",
  });
  assert.equal(result.ok, true);
  assert.equal(result.stateCode, "SP");
});

test("parseNfQrInput: chave válida sempre traz UF da chave", () => {
  const result = parseNfQrInput({ accessKey: SP_KEY });
  assert.equal(result.ok, true);
  assert.equal(result.stateCode, "SP");
});
