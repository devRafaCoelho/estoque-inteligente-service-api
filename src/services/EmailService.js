const fs = require("node:fs/promises");
const path = require("node:path");
const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

let transporter;
let lastVerifyOk = null;

function isSmtpConfigured() {
  return Boolean(String(env.SMTP_HOST || "").trim());
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isSmtpConfigured()) return null;

  const port = Number(env.SMTP_PORT) || 587;
  const secure = Boolean(env.SMTP_SECURE) || port === 465;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    // Porta 587 (Gmail) precisa de STARTTLS
    requireTLS: !secure && port === 587,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    auth:
      env.SMTP_USER || env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    tls: {
      // Aceita chain padrão; evita falhas de MITM intermediário em some PaaS
      minVersion: "TLSv1.2",
    },
  });
  return transporter;
}

function resolveFromAddress() {
  // Gmail costuma recusar From diferente do usuário autenticado
  const from = String(env.EMAIL_FROM || "").trim();
  const user = String(env.SMTP_USER || "").trim();
  if (user && from && from.toLowerCase() !== user.toLowerCase()) {
    logger.warn("EMAIL_FROM difere de SMTP_USER — usando SMTP_USER no From (melhor para Gmail)", {
      emailFrom: from,
      smtpUser: user,
    });
    return user;
  }
  return from || user || "noreply@estoque-inteligente.local";
}

async function writePreview(mail) {
  const dir = path.resolve(process.cwd(), env.EMAIL_PREVIEW_DIR);
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${stamp}-${mail.subject.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.json`;
  const filePath = path.join(dir, filename);
  const preview = {
    ...mail,
    attachments: (mail.attachments || []).map((item) => ({
      filename: item.filename,
      cid: item.cid,
      path: item.path,
    })),
  };
  await fs.writeFile(filePath, JSON.stringify(preview, null, 2), "utf8");
  if (mail.html) {
    const htmlPath = filePath.replace(/\.json$/, ".html");
    await fs.writeFile(htmlPath, mail.html, "utf8");
  }
  logger.info("E-mail salvo em preview local (SMTP não configurado)", {
    filePath,
    to: mail.to,
    subject: mail.subject,
    nodeEnv: env.NODE_ENV,
  });
  return { preview: true, delivered: false, filePath };
}

const EmailService = {
  isConfigured: isSmtpConfigured,

  /**
   * Verifica SMTP no boot. Em produção sem SMTP, avisa alto.
   * Em dev, preview local é aceitável.
   */
  async warmUp() {
    if (!isSmtpConfigured()) {
      lastVerifyOk = false;
      if (env.NODE_ENV === "production") {
        logger.warn(
          "SMTP não configurado em produção — convites/reset não enviam e-mail real. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e EMAIL_FROM no Render.",
        );
      } else {
        logger.info("SMTP ausente — e-mails vão para EMAIL_PREVIEW_DIR");
      }
      return { configured: false, ok: false };
    }

    try {
      const tx = getTransporter();
      await tx.verify();
      lastVerifyOk = true;
      logger.info("SMTP verificado com sucesso", {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: Boolean(env.SMTP_SECURE),
        user: env.SMTP_USER ? String(env.SMTP_USER).replace(/(^.).*(@.*$)/, "$1***$2") : "",
        from: resolveFromAddress(),
      });
      return { configured: true, ok: true };
    } catch (err) {
      lastVerifyOk = false;
      logger.error("SMTP configurado, mas a verificação falhou", {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        message: err.message,
        code: err.code,
        response: err.response,
        // Dicas comuns Gmail/Render
        hint:
          "Confira senha de app do Gmail, variáveis no Render e se porta 587 não está bloqueada. Local ≠ datacenter: Gmail pode exigir reautenticar / app password.",
      });
      return { configured: true, ok: false, error: err.message };
    }
  },

  lastVerifyOk() {
    return lastVerifyOk;
  },

  async send({ to, subject, html, text, attachments = [] }) {
    const mail = {
      from: `"Estoque Inteligente" <${resolveFromAddress()}>`,
      to,
      subject,
      html,
      text,
      attachments,
    };
    const tx = getTransporter();
    if (!tx) return writePreview(mail);

    const info = await tx.sendMail(mail);
    logger.info("E-mail enviado via SMTP", {
      to,
      subject,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
    return {
      delivered: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  },

  /**
   * Envio best-effort: nunca quebra o fluxo de negócio se SMTP falhar/timeout.
   * Útil em cadastro/convite (já persistidos) no Render free / Gmail lento.
   */
  async sendSafe(payload) {
    try {
      return await this.send(payload);
    } catch (err) {
      logger.error("Falha ao enviar e-mail (fluxo segue sem e-mail)", {
        to: payload?.to,
        subject: payload?.subject,
        message: err.message,
        code: err.code,
        response: err.response,
        command: err.command,
      });
      return { delivered: false, preview: false, error: err.message, code: err.code };
    }
  },
};

module.exports = EmailService;
