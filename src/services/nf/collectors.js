const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const { parseNfceHtml } = require("./nfHtmlParser");

const DEFAULT_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; EstoqueInteligente/1.0; +https://github.com/devRafaCoelho)";

async function fetchText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text, finalUrl: response.url };
  } catch (err) {
    logger.warn("Falha ao consultar portal NF-e", { url, message: err.message });
    throw new AppError(
      "Não consegui consultar a nota no portal da SEFAZ. Tente a foto do cupom.",
      502,
      { cause: err.message, code: "nf_fetch_failed" },
    );
  } finally {
    clearTimeout(timer);
  }
}

function buildSpConsultaUrl(accessKey, qrContent) {
  if (qrContent && /nfce\.fazenda\.sp\.gov\.br/i.test(qrContent)) {
    return qrContent;
  }
  const p = `${accessKey}|2|1|1|`;
  return `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(p)}`;
}

function buildMgConsultaUrl(accessKey, qrContent) {
  if (qrContent && /fazenda\.mg\.gov\.br/i.test(qrContent)) {
    return qrContent;
  }
  return `https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=${encodeURIComponent(accessKey)}`;
}

/**
 * @param {string} html
 * @param {string} pageUrl
 */
function extractIframeUrl(html, pageUrl) {
  const match = String(html).match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (!match) return null;
  try {
    return new URL(match[1], pageUrl).href;
  } catch {
    return null;
  }
}

/**
 * @param {{ accessKey: string, qrContent?: string|null, stateCode: string }} input
 * @param {(accessKey: string, qrContent?: string|null) => string} buildUrl
 */
async function collectFromPortal(input, buildUrl) {
  const firstUrl = buildUrl(input.accessKey, input.qrContent);
  const first = await fetchText(firstUrl);
  let html = first.text;
  let usedUrl = first.finalUrl || firstUrl;

  const iframeUrl = extractIframeUrl(html, usedUrl);
  if (iframeUrl) {
    const nested = await fetchText(iframeUrl);
    html = nested.text;
    usedUrl = nested.finalUrl || iframeUrl;
  }

  if (/captcha|recaptcha|acesso\s+negado|cloudflare/i.test(html)) {
    throw new AppError(
      "O portal da SEFAZ pediu captcha ou bloqueou a consulta. Use a foto do cupom.",
      502,
      { code: "nf_captcha" },
    );
  }

  const parsed = parseNfceHtml(html);
  if (!parsed.items.length) {
    throw new AppError(
      "Consultei a nota, mas não encontrei itens legíveis. Use a foto do cupom.",
      422,
      { code: "nf_empty_items", consultaUrl: usedUrl },
    );
  }

  return {
    items: parsed.items,
    storeName: parsed.storeName,
    consultaUrl: usedUrl,
    collector: input.stateCode,
  };
}

const SpNfCollector = {
  async collect(input) {
    return collectFromPortal(input, buildSpConsultaUrl);
  },
};

const MgNfCollector = {
  async collect(input) {
    return collectFromPortal(input, buildMgConsultaUrl);
  },
};

module.exports = {
  SpNfCollector,
  MgNfCollector,
  buildSpConsultaUrl,
  buildMgConsultaUrl,
  fetchText,
};
