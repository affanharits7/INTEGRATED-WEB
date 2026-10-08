import { useState } from "react";
import { KeyRound, Send, ShieldAlert } from "lucide-react";
import { Button, ErrorNote, Field, JsonView, Panel } from "../components/ui";
import { hmacHex, joinUrl, request } from "../lib/api";
import { useAction } from "../lib/hooks";

const SAMPLE = '{\n  "id": 1,\n  "item": "Kopi susu",\n  "qty": 2\n}';

export default function WebhookPanel({ hook }) {
  const [secret, setSecret] = useState("");
  const [table, setTable] = useState("orders");
  const [record, setRecord] = useState(SAMPLE);
  const [last, setLast] = useState(null);

  const [state, run] = useAction(async (tamper) => {
    let parsed;
    try {
      parsed = JSON.parse(record);
    } catch {
      throw new Error("Record bukan JSON yang valid.");
    }
    if (!secret) throw new Error("Isi WEBHOOK_SECRET terlebih dahulu.");
    const body = JSON.stringify({ type: "INSERT", table, schema: "public", record: parsed });
    const sig = await hmacHex(tamper ? `${secret}-salah` : secret, body);
    const res = await request(joinUrl(hook, "/api/webhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": `sha256=${sig}` },
      body,
    });
    setLast({ tamper, sig, body });
    return res;
  });
  const res = state.data;

  return (
    <Panel
      icon={Send}
      title="Webhook Supabase → Telegram"
      description="Payload ditandatangani HMAC-SHA256 di browser, dikirim ke /api/webhook, lalu diteruskan ke bot Telegram jika signature valid."
    >
      <div className="note note-warn">
        <ShieldAlert size={18} />
        <span>
          Hanya untuk pengujian. Secret tidak disimpan, tetapi jangan mengetiknya saat layar dibagikan. Di produksi,
          signature dibuat oleh trigger Supabase, bukan browser.
        </span>
      </div>

      <div className="form-row">
        <Field label="WEBHOOK_SECRET">
          <div className="input-icon">
            <KeyRound size={16} />
            <input
              type="password"
              value={secret}
              autoComplete="off"
              onChange={(e) => setSecret(e.target.value)}
              placeholder="sama dengan env var di Vercel"
            />
          </div>
        </Field>
        <Field label="Nama tabel">
          <input value={table} onChange={(e) => setTable(e.target.value)} />
        </Field>
      </div>
      <Field label="Record (JSON)">
        <textarea rows={6} value={record} onChange={(e) => setRecord(e.target.value)} spellCheck={false} />
      </Field>

      <div className="btn-group">
        <Button icon={Send} loading={state.loading} onClick={() => run(false)}>
          Kirim dengan signature benar
        </Button>
        <Button variant="danger" icon={ShieldAlert} loading={state.loading} onClick={() => run(true)}>
          Kirim dengan signature salah
        </Button>
      </div>
      <ErrorNote>{state.error}</ErrorNote>

      {res && (
        <div className="result">
          <div className={`note ${res.ok ? "note-ok" : "note-bad"}`}>
            <strong>HTTP {res.status}</strong>
            <span>
              {res.ok
                ? "Diterima. Pesan dikirim ke Telegram."
                : res.status === 401
                ? last?.tamper
                  ? "Ditolak seperti yang diharapkan: signature tidak cocok."
                  : "Ditolak: signature tidak cocok. Periksa WEBHOOK_SECRET."
                : "Permintaan gagal."}
            </span>
          </div>
          <JsonView data={res.data} />
          {last && <JsonView title="Header x-signature yang dikirim" data={`sha256=${last.sig}`} />}
        </div>
      )}
    </Panel>
  );
}
