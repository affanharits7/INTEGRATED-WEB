import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";

process.env.WEBHOOK_SECRET = "rahasia";
process.env.TELEGRAM_BOT_TOKEN = "TOKEN";
process.env.TELEGRAM_CHAT_ID = "42";

const { default: handler } = await import("../api/webhook.js");

const sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url, body: JSON.parse(init.body) });
  return { ok: true, status: 200, text: async () => "" };
};

const sign = (body, secret = "rahasia") => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

async function call({ method = "POST", body = "{}", signature }) {
  const req = Object.assign(Readable.from([Buffer.from(body)]), {
    method,
    headers: signature === undefined ? {} : { "x-signature": signature },
  });
  const out = { code: 0, json: null, headers: {} };
  const res = {
    setHeader: (k, v) => (out.headers[k] = v),
    status: (c) => ((out.code = c), res),
    json: (j) => ((out.json = j), res),
  };
  await handler(req, res);
  return out;
}

const payload = JSON.stringify({ type: "INSERT", table: "orders", schema: "public", record: { id: 1, note: "<b>x</b>" } });

assert.equal((await call({ method: "GET" })).code, 405);
assert.equal((await call({ body: payload })).code, 401, "tanpa signature");
assert.equal((await call({ body: payload, signature: sign(payload, "salah") })).code, 401, "secret salah");
assert.equal((await call({ body: payload, signature: "sha256=zz" })).code, 401, "format salah");
assert.equal((await call({ body: payload + " ", signature: sign(payload) })).code, 401, "body diubah");
assert.equal(sent.length, 0, "tidak boleh kirim Telegram untuk request tidak valid");

const ok = await call({ body: payload, signature: sign(payload) });
assert.equal(ok.code, 200);
assert.equal(sent.length, 1);
assert.equal(sent[0].url, "https://api.telegram.org/botTOKEN/sendMessage");
assert.equal(sent[0].body.chat_id, "42");
assert.match(sent[0].body.text, /INSERT/);
assert.match(sent[0].body.text, /&lt;b&gt;x&lt;\/b&gt;/, "HTML di-escape");

const bad = "bukan json";
assert.equal((await call({ body: bad, signature: sign(bad) })).code, 400);

console.log("semua tes lolos");
