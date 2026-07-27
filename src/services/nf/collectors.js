const cheerio = require("cheerio");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const { parseNfceHtml } = require("./nfHtmlParser");

const DEFAULT_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; EstoqueInteligente/1.0; +https://github.com/devRafaCoelho)";

function mergeCookies(cookieJar, setCookieHeaders) {
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const raw of headers) {
    const pair = String(raw).split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) cookieJar[name] = value;
  }
}

function cookieHeader(cookieJar) {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * @param {string} url
 * @param {{ method?: string, body?: string|URLSearchParams, cookieJar?: Record<string,string>, timeoutMs?: number, referer?: string }} [opts]
 */
async function fetchText(url, opts = {}) {
  const {
    method = "GET",
    body = undefined,
    cookieJar = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    referer,
  } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9",
    };
    const cookie = cookieHeader(cookieJar);
    if (cookie) headers.Cookie = cookie;
    if (referer) headers.Referer = referer;
    if (body != null) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers,
      body: body != null ? String(body) : undefined,
    });

    if (typeof response.headers.getSetCookie === "function") {
      mergeCookies(cookieJar, response.headers.getSetCookie());
    } else {
      const single = response.headers.get("set-cookie");
      if (single) mergeCookies(cookieJar, [single]);
    }

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
      finalUrl: response.url,
      cookieJar,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn("Falha ao consultar portal NF-e", { url, message: err.message });
    throw new AppError(
      "Não consegui consultar a nota no portal da SEFAZ. Tente a foto da nota.",
      502,
      { cause: err.message, code: "nf_fetch_failed", fallback: "photo" },
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
 * BA exige o parâmetro `p` completo do QR (inclui CSC/hash). Só a chave não basta.
 * @param {string} accessKey
 * @param {string|null|undefined} qrContent
 */
function buildBaConsultaUrl(accessKey, qrContent) {
  const raw = String(qrContent || "").trim();
  if (raw && /sefaz\.ba\.gov\.br/i.test(raw)) {
    try {
      return new URL(raw).href;
    } catch {
      if (/^https?:\/\//i.test(raw)) return raw;
      return `http://${raw.replace(/^\/+/, "")}`;
    }
  }

  const p = `${accessKey}|2|1|1|`;
  return `http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx?p=${encodeURIComponent(p)}`;
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

function assertPortalHtmlUsable(html) {
  if (/captcha|recaptcha|acesso\s+negado|cloudflare|anti.?robo/i.test(html)) {
    throw new AppError(
      "O portal da SEFAZ pediu captcha ou bloqueou a consulta. Use a foto da nota.",
      502,
      { code: "nf_captcha", fallback: "photo" },
    );
  }
  if (/Problema\(s\) apresentado\(s\) no QR Code|Hash do QR Code n/i.test(html)) {
    throw new AppError(
      "QR da Bahia incompleto ou inválido. Escaneie o QR da nota de novo ou use a foto.",
      422,
      { code: "nf_invalid_qr", fallback: "photo" },
    );
  }
  if (/URL para consulta da NFC-e, via QRCode, não informada/i.test(html)) {
    throw new AppError(
      "URL do QR da Bahia ausente. Escaneie o QR completo ou use a foto da nota.",
      422,
      { code: "nf_invalid_qr", fallback: "photo" },
    );
  }
}

/**
 * Mensagens de erro do portal BA (#lblInformacao).
 * @param {string} html
 */
function assertBaPortalNotError(html) {
  const $ = cheerio.load(String(html || ""));
  const info = $("#lblInformacao").text().replace(/\s+/g, " ").trim();
  if (!info) return;

  if (/CSC|hash|QRCode|QR Code|chave|inv[aá]lid|inexistent|n[aã]o informad/i.test(info)) {
    throw new AppError(
      `Portal da Bahia: ${info}. Escaneie o QR completo da nota ou use a foto.`,
      422,
      { code: "nf_invalid_qr", portalMessage: info, fallback: "photo" },
    );
  }

  throw new AppError(
    `Portal da Bahia rejeitou a consulta: ${info}. Use a foto da nota.`,
    502,
    { code: "nf_collector_failed", portalMessage: info, fallback: "photo" },
  );
}

/**
 * Monta body de POST ASP.NET WebForms a partir do HTML e do botão clicado.
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ name?: string, value?: string, id?: string }} button
 */
function buildAspNetPost(html, pageUrl, button) {
  const $ = cheerio.load(String(html || ""));
  const form = $("form").first();
  if (!form.length) return null;

  const actionRaw = form.attr("action") || pageUrl;
  let actionUrl;
  try {
    actionUrl = new URL(actionRaw, pageUrl).href;
  } catch {
    actionUrl = pageUrl;
  }

  const params = new URLSearchParams();
  form.find("input").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name");
    if (!name) return;
    const type = String($el.attr("type") || "text").toLowerCase();
    if (type === "submit" || type === "button" || type === "image" || type === "reset") {
      return;
    }
    params.set(name, $el.attr("value") ?? "");
  });

  let clicked = null;
  if (button.id) {
    clicked = form.find(`#${button.id}`).first();
  }
  if ((!clicked || !clicked.length) && button.name) {
    clicked = form.find(`input[name="${button.name}"], button[name="${button.name}"]`).first();
  }
  if ((!clicked || !clicked.length) && button.value) {
    clicked = form
      .find("input[type=submit], input[type=button], button")
      .filter((_, el) => $(el).attr("value") === button.value || $(el).text().trim() === button.value)
      .first();
  }

  if (clicked && clicked.length) {
    const name = clicked.attr("name");
    if (name) {
      params.set(name, clicked.attr("value") ?? button.value ?? "");
    }
  } else if (button.name) {
    params.set(button.name, button.value ?? "");
  } else {
    return null;
  }

  return { actionUrl, body: params.toString() };
}

function hasBaProductsMarkup(html) {
  return /\btable_produtos\b|formo-prod-serv-descricao|\btxtTit\b/i.test(String(html || ""));
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
    const nested = await fetchText(iframeUrl, { cookieJar: first.cookieJar });
    html = nested.text;
    usedUrl = nested.finalUrl || iframeUrl;
  }

  assertPortalHtmlUsable(html);

  const parsed = parseNfceHtml(html);
  if (!parsed.items.length) {
    throw new AppError(
      "Consultei a nota, mas não encontrei itens legíveis. Use a foto da nota.",
      422,
      { code: "nf_empty_items", consultaUrl: usedUrl, fallback: "photo" },
    );
  }

  return {
    items: parsed.items,
    storeName: parsed.storeName,
    consultaUrl: usedUrl,
    collector: input.stateCode,
  };
}

/**
 * BA: GET QR → (opcional) Visualizar em Abas → aba Produtos → parse.
 * @param {{ accessKey: string, qrContent?: string|null, stateCode: string }} input
 */
async function collectBaFromPortal(input) {
  const firstUrl = buildBaConsultaUrl(input.accessKey, input.qrContent);
  const cookieJar = {};
  const first = await fetchText(firstUrl, { cookieJar });
  let html = first.text;
  let usedUrl = first.finalUrl || firstUrl;

  assertPortalHtmlUsable(html);
  assertBaPortalNotError(html);

  let parsed = parseNfceHtml(html);
  if (parsed.items.length) {
    return {
      items: parsed.items,
      storeName: parsed.storeName,
      consultaUrl: usedUrl,
      collector: input.stateCode,
    };
  }

  // Portal BA costuma exigir POST ASP.NET para listar produtos.
  if (!hasBaProductsMarkup(html)) {
    const abasPost = buildAspNetPost(html, usedUrl, {
      value: "Visualizar em Abas",
    });
    if (abasPost) {
      const abas = await fetchText(abasPost.actionUrl, {
        method: "POST",
        body: abasPost.body,
        cookieJar,
        referer: usedUrl,
      });
      html = abas.text;
      usedUrl = abas.finalUrl || abasPost.actionUrl;
      assertPortalHtmlUsable(html);
      assertBaPortalNotError(html);
    }
  }

  parsed = parseNfceHtml(html);
  if (parsed.items.length) {
    return {
      items: parsed.items,
      storeName: parsed.storeName,
      consultaUrl: usedUrl,
      collector: input.stateCode,
    };
  }

  const produtosPost =
    buildAspNetPost(html, usedUrl, { id: "btn_aba_produtos", name: "btn_aba_produtos" }) ||
    buildAspNetPost(html, usedUrl, { value: "Produtos / Serviços" }) ||
    buildAspNetPost(html, usedUrl, { value: "Produtos/Serviços" });

  if (produtosPost) {
    const produtos = await fetchText(produtosPost.actionUrl, {
      method: "POST",
      body: produtosPost.body,
      cookieJar,
      referer: usedUrl,
    });
    html = produtos.text;
    usedUrl = produtos.finalUrl || produtosPost.actionUrl;
    assertPortalHtmlUsable(html);
    assertBaPortalNotError(html);
  }

  parsed = parseNfceHtml(html);
  if (!parsed.items.length) {
    throw new AppError(
      "Consultei a nota na Bahia, mas não encontrei itens legíveis. Use a foto da nota.",
      422,
      { code: "nf_empty_items", consultaUrl: usedUrl, fallback: "photo" },
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

const BaNfCollector = {
  async collect(input) {
    const qr = String(input.qrContent || "").trim();
    if (!qr || !/sefaz\.ba\.gov\.br/i.test(qr)) {
      throw new AppError(
        "Para notas da Bahia, escaneie o QR completo da nota (a chave sozinha não basta). Ou use a foto.",
        422,
        { code: "nf_ba_qr_required", stateCode: "BA", fallback: "photo" },
      );
    }
    return collectBaFromPortal(input);
  },
};

module.exports = {
  SpNfCollector,
  MgNfCollector,
  BaNfCollector,
  buildSpConsultaUrl,
  buildMgConsultaUrl,
  buildBaConsultaUrl,
  fetchText,
};
