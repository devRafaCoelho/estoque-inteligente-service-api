const fs = require("node:fs/promises");
const path = require("node:path");
const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER || env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return transporter;
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
  // HTML legível para abrir no navegador
  if (mail.html) {
    const htmlPath = filePath.replace(/\.json$/, ".html");
    await fs.writeFile(htmlPath, mail.html, "utf8");
  }
  logger.info("E-mail salvo em preview local", { filePath, to: mail.to, subject: mail.subject });
  return { preview: true, filePath };
}

const EmailService = {
  async send({ to, subject, html, text, attachments = [] }) {
    const mail = {
      from: `"Estoque Inteligente" <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
      attachments,
    };
    const tx = getTransporter();
    if (!tx) return writePreview(mail);
    await tx.sendMail(mail);
    return { delivered: true };
  },
};

module.exports = EmailService;
