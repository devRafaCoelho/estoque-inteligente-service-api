const cheerio = require("cheerio");
const AppError = require("../../utils/AppError");
const { parseNfceHtml } = require("./nfHtmlParser");
const {
  fetchText,
  assertPortalHtmlUsable,
  collectFromPortal,
  buildAspNetPost,
} = require("./portalHelpers");

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

/** RJ — ENCAT: consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode */
function buildRjConsultaUrl(accessKey, qrContent) {
  const raw = String(qrContent || "").trim();
  if (raw && /fazenda\.rj\.gov\.br/i.test(raw)) {
    try {
      return new URL(raw).href;
    } catch {
      if (/^https?:\/\//i.test(raw)) return raw;
      return `https://${raw.replace(/^\/+/, "")}`;
    }
  }
  const p = `${accessKey}|2|1|1|`;
  return `https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode?p=${encodeURIComponent(p)}`;
}

/** PR — ENCAT: fazenda.pr.gov.br/nfce/qrcode */
function buildPrConsultaUrl(accessKey, qrContent) {
  const raw = String(qrContent || "").trim();
  if (raw && /fazenda\.pr\.gov\.br/i.test(raw)) {
    try {
      return new URL(raw).href;
    } catch {
      if (/^https?:\/\//i.test(raw)) return raw;
      return `http://${raw.replace(/^\/+/, "")}`;
    }
  }
  const p = `${accessKey}|2|1|1|`;
  return `http://www.fazenda.pr.gov.br/nfce/qrcode?p=${encodeURIComponent(p)}`;
}

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

function hasBaProductsMarkup(html) {
  return /\btable_produtos\b|formo-prod-serv-descricao|\btxtTit\b/i.test(String(html || ""));
}

/**
 * BA: GET QR → (opcional) Visualizar em Abas → aba Produtos → parse.
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

/** Contrato por UF: `{ collect(input) }` → itens + storeName + consultaUrl. */
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

const RjNfCollector = {
  async collect(input) {
    return collectFromPortal(input, buildRjConsultaUrl);
  },
};

const PrNfCollector = {
  async collect(input) {
    return collectFromPortal(input, buildPrConsultaUrl);
  },
};

module.exports = {
  SpNfCollector,
  MgNfCollector,
  BaNfCollector,
  RjNfCollector,
  PrNfCollector,
  buildSpConsultaUrl,
  buildMgConsultaUrl,
  buildBaConsultaUrl,
  buildRjConsultaUrl,
  buildPrConsultaUrl,
  fetchText,
};
