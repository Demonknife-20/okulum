// E-posta gönderimi (SMTP). SMTP_HOST ve SMTP_FROM tanımlıysa gerçek gönderim yapılır.
// Test ortamında MAIL_OUTBOX_FILE tanımlıysa e-postalar bu dosyaya (JSON satırı) yazılır.
const fs = require('node:fs');

let transport = null;
const configured = () => Boolean(process.env.MAIL_OUTBOX_FILE || (process.env.SMTP_HOST && process.env.SMTP_FROM));

async function send({ to, subject, text }) {
  if (process.env.MAIL_OUTBOX_FILE) {
    fs.appendFileSync(process.env.MAIL_OUTBOX_FILE, `${JSON.stringify({ to, subject, text })}\n`);
    return;
  }
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
    });
  }
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}

module.exports = { configured, send };
