// E-posta gönderimi. Öncelik sırası:
// 1) RESEND_API_KEY tanımlıysa Resend HTTPS API'si (443 portu; SMTP engellenebilen ortamlarda da çalışır)
// 2) SMTP_HOST ve SMTP_FROM tanımlıysa SMTP
// Test ortamında MAIL_OUTBOX_FILE tanımlıysa e-postalar bu dosyaya (JSON satırı) yazılır.
const fs = require('node:fs');

let transport = null;
const configured = () => Boolean(
  process.env.MAIL_OUTBOX_FILE
  || (process.env.RESEND_API_KEY && process.env.SMTP_FROM)
  || (process.env.SMTP_HOST && process.env.SMTP_FROM),
);

async function sendViaResend({ to, subject, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.SMTP_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 200)}`);
  }
}

async function sendViaSmtp({ to, subject, text }) {
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

async function send({ to, subject, text }) {
  if (process.env.MAIL_OUTBOX_FILE) {
    fs.appendFileSync(process.env.MAIL_OUTBOX_FILE, `${JSON.stringify({ to, subject, text })}\n`);
    return;
  }
  if (process.env.RESEND_API_KEY) return sendViaResend({ to, subject, text });
  return sendViaSmtp({ to, subject, text });
}

module.exports = { configured, send };
