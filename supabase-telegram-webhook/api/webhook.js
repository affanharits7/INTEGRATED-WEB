import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC dihitung dari byte body mentah, jadi parser JSON bawaan Vercel dimatikan.
export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 100 * 1024;

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("payload too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Header format: "sha256=<hex>" (awalan opsional). Perbandingan constant-time. */
export function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const received = header.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(received, "hex"));
}

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatMessage(payload) {
  const { type = "EVENT", table = "?", schema = "public", record, old_record } = payload;
  const body = JSON.stringify(record ?? old_record ?? {}, null, 2);
  return `<b>${escapeHtml(type)}</b> pada <code>${escapeHtml(schema)}.${escapeHtml(table)}</code>\n<pre>${escapeHtml(body).slice(0, 3500)}</pre>`;
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw Object.assign(new Error(`telegram: ${res.status} ${await res.text()}`), { status: 502 });
}

export default async function handler(req, res) {
  // Aman membuka origin: setiap request tetap wajib membawa HMAC yang valid.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-signature");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const { WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!WEBHOOK_SECRET || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("environment variable belum lengkap");
    return res.status(500).json({ error: "server misconfigured" });
  }

  try {
    const raw = await readRawBody(req);

    if (!verifySignature(raw, req.headers["x-signature"], WEBHOOK_SECRET)) {
      return res.status(401).json({ error: "invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "invalid json" });
    }

    await sendTelegram(formatMessage(payload));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err.message);
    return res.status(err.status ?? 500).json({ error: err.status === 413 ? err.message : "internal error" });
  }
}
