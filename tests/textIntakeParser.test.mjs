import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseHeuristicIntake,
  splitItemChunks,
  looksLikeCollapsedMultiItem,
} = require("../src/services/parsers/textIntakeParser.js");

{
  const chunks = splitItemChunks("2 kg de arroz um leite 500 gramas de feijão");
  assert.deepEqual(chunks, [
    "2 kg de arroz",
    "um leite",
    "500 gramas de feijão",
  ]);
}

{
  const parsed = parseHeuristicIntake("2 kg de arroz um leite 500 gramas de feijão");
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0].name, "Arroz");
  assert.equal(parsed.items[0].quantity, 2);
  assert.equal(parsed.items[0].unit, "kg");
  assert.equal(parsed.items[1].name, "Leite");
  assert.equal(parsed.items[1].quantity, 1);
  assert.equal(parsed.items[1].unit, "un");
  assert.equal(parsed.items[2].name, "Feijão");
  assert.equal(parsed.items[2].quantity, 500);
  assert.equal(parsed.items[2].unit, "g");
}

{
  const withCommas = parseHeuristicIntake("2kg arroz, 1 leite, 500g feijão");
  assert.equal(withCommas.items.length, 3);
}

{
  const collapsed = looksLikeCollapsedMultiItem(
    { name: "Arroz Um Leite 500 Gramas De Feijão" },
    [
      { name: "Arroz" },
      { name: "Leite" },
      { name: "Feijão" },
    ],
  );
  assert.equal(collapsed, true);
}

console.log("textIntakeParser.test.mjs: ok");
