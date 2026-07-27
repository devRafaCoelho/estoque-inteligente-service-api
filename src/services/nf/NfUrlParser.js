const IBGE_UF_BY_CODE = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

function normalizeAccessKeyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function computeAccessKeyCheckDigit(first43) {
  const digits = String(first43 || "");
  if (!/^\d{43}$/.test(digits)) return null;
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  return 11 - remainder;
}

/**
 * @param {string} raw
 */
function parseAccessKey(raw) {
  const accessKey = normalizeAccessKeyDigits(raw);
  if (accessKey.length !== 44 || !/^\d{44}$/.test(accessKey)) {
    return { ok: false, reason: "length" };
  }
  const expected = computeAccessKeyCheckDigit(accessKey.slice(0, 43));
  if (expected == null || Number(accessKey[43]) !== expected) {
    return { ok: false, reason: "checkDigit" };
  }
  const stateIbge = accessKey.slice(0, 2);
  const stateCode = IBGE_UF_BY_CODE[stateIbge] || null;
  if (!stateCode) return { ok: false, reason: "state" };
  const model = accessKey.slice(20, 22);
  if (model !== "55" && model !== "65") return { ok: false, reason: "model" };

  return {
    ok: true,
    accessKey,
    stateIbge,
    stateCode,
    model,
    number: String(Number(accessKey.slice(25, 34))),
    series: accessKey.slice(22, 25),
    emitCnpj: accessKey.slice(6, 20),
  };
}

function extractAccessKeyCandidate(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const digitsOnly = normalizeAccessKeyDigits(text);
  if (digitsOnly.length === 44) return digitsOnly;

  try {
    const url = new URL(text);
    for (const key of ["chNFe", "chaveAcesso", "chave", "chNfe", "p"]) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      const fromParam = normalizeAccessKeyDigits(value.split("|")[0]);
      if (fromParam.length >= 44) return fromParam.slice(0, 44);
    }
    const match = normalizeAccessKeyDigits(url.href).match(/\d{44}/);
    if (match) return match[0];
  } catch {
    // ignore
  }

  const match = digitsOnly.match(/\d{44}/) || text.match(/\d{44}/);
  return match ? match[0] : "";
}

/**
 * Extrai UF/chave/URL a partir do conteúdo do QR ou chave colada.
 * @param {{ qrContent?: string, accessKey?: string, stateCode?: string }} body
 */
function parseNfQrInput(body = {}) {
  const raw = String(body.qrContent || body.accessKey || "").trim();
  if (!raw) return { ok: false, reason: "empty" };

  const candidate = extractAccessKeyCandidate(raw);
  if (!candidate) return { ok: false, reason: "notFound" };

  const parsed = parseAccessKey(candidate);
  if (!parsed.ok) return parsed;

  let qrContent = null;
  try {
    qrContent = new URL(raw).href;
  } catch {
    qrContent = null;
  }

  const stateCode = String(body.stateCode || parsed.stateCode || "")
    .trim()
    .toUpperCase() || parsed.stateCode;

  return {
    ok: true,
    accessKey: parsed.accessKey,
    stateCode,
    model: parsed.model,
    number: parsed.number,
    series: parsed.series,
    emitCnpj: parsed.emitCnpj,
    qrContent,
    rawInput: raw,
  };
}

module.exports = {
  IBGE_UF_BY_CODE,
  normalizeAccessKeyDigits,
  parseAccessKey,
  extractAccessKeyCandidate,
  parseNfQrInput,
};
