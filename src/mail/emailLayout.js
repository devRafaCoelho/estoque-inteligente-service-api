const path = require("node:path");
const env = require("../config/env");

const BRAND = {
  name: "Estoque Inteligente",
  green: "#1f7a4d",
  greenDark: "#0f3d28",
  greenSoft: "#e8f5ee",
  cream: "#f7f4ef",
  text: "#243028",
  muted: "#5f6f66",
};

const LOGO_CID = "brand-logo@estoque-inteligente";
const LOGO_PATH = path.resolve(__dirname, "../../assets/email/brand-logo.png");

function appUrl(pathname = "/") {
  const base = String(env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
  const pathName = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${pathName}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoAttachment() {
  return {
    filename: "brand-logo.png",
    path: LOGO_PATH,
    cid: LOGO_CID,
    contentDisposition: "inline",
  };
}

/**
 * Layout base dos e-mails transacionais (HTML + texto).
 */
function renderEmailLayout({
  preheader,
  eyebrow,
  title,
  greeting,
  paragraphs = [],
  bullets = [],
  ctaLabel,
  ctaHref,
  footnote,
}) {
  const safeParagraphs = paragraphs.map((item) => escapeHtml(item));
  const safeBullets = bullets.map((item) => escapeHtml(item));
  const textBody = [
    title,
    "",
    greeting,
    ...paragraphs,
    ...(bullets.length ? ["", ...bullets.map((item) => `• ${item}`)] : []),
    ...(ctaHref ? ["", `${ctaLabel}: ${ctaHref}`] : []),
    footnote ? `\n${footnote}` : "",
  ]
    .filter((line) => line != null && line !== "")
    .join("\n");

  const fontStack = "'Nunito', 'Segoe UI', Arial, sans-serif";

  const bulletHtml = safeBullets.length
    ? `<ul style="margin:0 0 22px;padding-left:20px;color:${BRAND.text};font-family:${fontStack};font-size:15px;line-height:1.6;">${safeBullets
        .map(
          (item) =>
            `<li style="margin-bottom:8px;font-family:${fontStack};">${item}</li>`,
        )
        .join("")}</ul>`
    : "";

  const ctaHtml =
    ctaLabel && ctaHref
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 24px;">
          <tr>
            <td align="center" valign="middle" bgcolor="${BRAND.green}" style="border-radius:999px;background-color:${BRAND.green};text-align:center;vertical-align:middle;mso-padding-alt:14px 28px;">
              <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:14px 28px;color:#ffffff !important;text-decoration:none;font-family:${fontStack};font-weight:800;font-size:15px;line-height:1.2;text-align:center;vertical-align:middle;mso-line-height-rule:exactly;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <!--<![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
    body, table, td, p, a, li, h1 { font-family: ${fontStack} !important; }
  </style>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:${fontStack};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || "")}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:28px 12px;font-family:${fontStack};">
    <tr>
      <td align="center" style="font-family:${fontStack};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(15,61,40,0.10);font-family:${fontStack};">
          <tr>
            <td style="background:linear-gradient(145deg, ${BRAND.greenDark} 0%, ${BRAND.green} 100%);padding:28px 28px 22px;text-align:center;font-family:${fontStack};">
              <img src="cid:${LOGO_CID}" alt="${escapeHtml(BRAND.name)}" width="168" style="display:block;margin:0 auto 14px;max-width:168px;height:auto;border:0;" />
              ${
                eyebrow
                  ? `<p style="margin:0;font-family:${fontStack};font-size:18px;line-height:1.3;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;font-weight:800;">${escapeHtml(eyebrow)}</p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;font-family:${fontStack};">
              <h1 style="margin:0 0 12px;font-family:${fontStack};font-size:28px;line-height:1.25;color:${BRAND.greenDark};font-weight:800;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:0 0 18px;font-family:${fontStack};font-size:16px;line-height:1.55;color:${BRAND.text};font-weight:700;">
                ${escapeHtml(greeting)}
              </p>
              ${safeParagraphs
                .map(
                  (item) =>
                    `<p style="margin:0 0 14px;font-family:${fontStack};font-size:15px;line-height:1.65;color:${BRAND.muted};">${item}</p>`,
                )
                .join("")}
              ${bulletHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-family:${fontStack};">
              <div style="border-radius:16px;background:${BRAND.greenSoft};padding:14px 16px;">
                <p style="margin:0;font-family:${fontStack};font-size:13px;line-height:1.55;color:${BRAND.greenDark};">
                  ${escapeHtml(footnote || "Com carinho, equipe Estoque Inteligente.")}
                </p>
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:${fontStack};font-size:12px;color:#8a968f;">
          ${escapeHtml(BRAND.name)} · organize a despensa sem estresse
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    text: textBody,
    attachments: [logoAttachment()],
  };
}

function welcomeEmail({ firstName, provider }) {
  const name = firstName || "você";
  const via =
    provider === "google"
      ? "pelo Google"
      : provider === "apple"
        ? "pela Apple"
        : "com e-mail e senha";

  return {
    subject: "Bem-vindo(a) ao Estoque Inteligente 🌿",
    ...renderEmailLayout({
      preheader: "Sua despensa inteligente já está pronta para começar.",
      eyebrow: "Conta criada",
      title: `Oi, ${name}! Que bom ter você aqui`,
      greeting: `Sua conta foi criada ${via} e o Estoque Inteligente já está pronto para facilitar seu dia a dia.`,
      paragraphs: [
        "A ideia é simples: menos esquecimento na despensa, menos compra por impulso e mais tranquilidade na cozinha.",
        "Comece cadastrando o que você já tem em casa — ou registre uma compra nova. Em poucos minutos os alertas passam a trabalhar por você.",
      ],
      bullets: [
        "Acompanhe o que está acabando",
        "Receba lembretes de recompra e baixa",
        "Monte listas de mercado no momento certo",
      ],
      ctaLabel: "Abrir meu estoque",
      ctaHref: appUrl("/dashboard"),
      footnote: "Qualquer dúvida, é só responder este e-mail. Estamos contigo nessa organização 💚",
    }),
  };
}

function passwordResetEmail({ firstName, resetUrl, ttlMinutes }) {
  const name = firstName || "olá";
  return {
    subject: "Redefinir senha · Estoque Inteligente",
    ...renderEmailLayout({
      preheader: `Seu link de redefinição vale por ${ttlMinutes} minutos.`,
      eyebrow: "Segurança da conta",
      title: `${name}, vamos criar uma senha nova?`,
      greeting: "Recebemos um pedido para redefinir o acesso da sua conta.",
      paragraphs: [
        `O link abaixo é válido por ${ttlMinutes} minutos. Se você não pediu essa alteração, pode ignorar este e-mail com tranquilidade.`,
      ],
      ctaLabel: "Criar nova senha",
      ctaHref: resetUrl,
      footnote: "Por segurança, nunca compartilhe este link com outra pessoa.",
    }),
  };
}

function digestEmail({ firstName, notifications }) {
  const name = firstName || "olá";
  const count = notifications.length;
  return {
    subject: `Seu resumo do Estoque Inteligente (${count})`,
    ...renderEmailLayout({
      preheader: `Você tem ${count} alerta(s) recente(s) para revisar.`,
      eyebrow: "Digest de alertas",
      title: `${name}, um resumo rapidinho pra você`,
      greeting:
        count === 1
          ? "Tem 1 notificação esperando sua atenção."
          : `Tem ${count} notificações esperando sua atenção.`,
      paragraphs: ["Aqui está o mesmo conteúdo dos alertas do app:"],
      bullets: notifications.map((item) => `${item.title}: ${item.body}`),
      ctaLabel: "Ver notificações",
      ctaHref: appUrl("/notificacoes"),
      footnote: "Você recebeu este resumo porque ativou o digest por e-mail em Minha Conta.",
    }),
  };
}

function householdInviteEmail({
  inviteeFirstName,
  inviterName,
  householdName,
  inviteUrl,
  ttlDays,
}) {
  const name = inviteeFirstName || "olá";
  const who = inviterName || "Alguém";
  const house = householdName || "uma conta familiar";
  return {
    subject: `${who} convidou você para ${house} · Estoque Inteligente`,
    ...renderEmailLayout({
      preheader: `Convite para entrar em ${house}. Válido por ${ttlDays} dias.`,
      eyebrow: "Conta familiar",
      title: `${name}, você foi convidado(a)`,
      greeting: `${who} quer compartilhar o estoque da casa com você.`,
      paragraphs: [
        `Ao aceitar, você passa a fazer parte de “${house}” no Estoque Inteligente.`,
        `O convite é válido por ${ttlDays} dias.`,
      ],
      ctaLabel: "Aceitar convite",
      ctaHref: inviteUrl,
      footnote: "Se você não esperava este e-mail, pode ignorá-lo com tranquilidade.",
    }),
  };
}

module.exports = {
  welcomeEmail,
  passwordResetEmail,
  digestEmail,
  householdInviteEmail,
  appUrl,
};
