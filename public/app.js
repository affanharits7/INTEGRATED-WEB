const { useState, useEffect } = React;
const html = htm.bind(React.createElement);

/* ---------- util ---------- */
const joinUrl = (base, path) => base.replace(/\/+$/, "") + path;

async function request(url, options) {
  const t0 = performance.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data, ms: performance.now() - t0 };
}

async function hmacHex(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function countOverlaps(jobs) {
  let overlap = 0, pairs = 0;
  for (let i = 0; i < jobs.length; i++)
    for (let j = i + 1; j < jobs.length; j++) {
      pairs++;
      if (jobs[i].started_at < jobs[j].finished_at && jobs[j].started_at < jobs[i].finished_at) overlap++;
    }
  return { overlap, pairs };
}

function useSaved(key, initial) {
  const [v, setV] = useState(() => { try { return localStorage.getItem(key) ?? initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, v); } catch {} }, [key, v]);
  return [v, setV];
}

function useAction(fn) {
  const [state, setState] = useState({ loading: false });
  const run = async (...args) => {
    setState({ loading: true });
    try { setState({ loading: false, data: await fn(...args) }); }
    catch (e) {
      const hint = e instanceof TypeError ? "Gagal terhubung. Periksa URL dan pastikan server aktif serta mengizinkan CORS." : e.message;
      setState({ loading: false, error: hint });
    }
  };
  return [state, run];
}

/* ---------- komponen kecil ---------- */
const Card = ({ title, sub, children }) => html`
  <section className="card"><h2>${title}</h2><p className="sub">${sub}</p>${children}</section>`;

const Stat = ({ label, value }) => html`<div className="stat"><b>${value}</b><span>${label}</span></div>`;
const Json = ({ data }) => html`<pre>${typeof data === "string" ? data : JSON.stringify(data, null, 2)}</pre>`;
const Err = ({ children }) => children ? html`<div className="err">${children}</div>` : null;

function Timeline({ bars }) {
  const min = Math.min(...bars.map((b) => b.start));
  const max = Math.max(...bars.map((b) => b.end));
  const span = max - min || 1;
  return html`<div className="tl">${bars.map((b, i) => html`
    <div className="tl-row" key=${i}>
      <span>${b.label}</span>
      <div className="tl-track"><div className="tl-bar" style=${{
        left: ((b.start - min) / span) * 100 + "%",
        width: Math.max(((b.end - b.start) / span) * 100, 0.8) + "%",
        background: b.color,
      }} /></div>
      <span>${(b.end - b.start).toFixed(2)}s</span>
    </div>`)}</div>`;
}

/* ---------- panel ---------- */
function Flow() {
  return html`<${Card} title="Arsitektur" sub="Dua layanan serverless di Vercel, satu frontend.">
    <div className="flow">
      <span className="node">Supabase</span>→<span className="node">Vercel /api/webhook (Node.js)</span>→<span className="node">Telegram Bot</span>
    </div>
    <div className="flow">
      <span className="node">Frontend React</span>→<span className="node">Vercel /api/* (FastAPI)</span>
    </div>
  <//>`;
}

function HealthPanel({ api }) {
  const [s, run] = useAction(() => request(joinUrl(api, "/api/health")));
  useEffect(() => { run(); }, [api]);
  const ok = s.data?.ok;
  return html`<${Card} title="Status API" sub="GET /api/health">
    <div className="row">
      ${s.loading ? html`<span className="badge">memeriksa…</span>` :
        ok ? html`<span className="badge ok">online · ${Math.round(s.data.ms)} ms</span>` :
        html`<span className="badge bad">${s.data ? "error " + s.data.status : "tidak terjangkau"}</span>`}
      <button className="ghost" onClick=${() => run()} disabled=${s.loading}>Periksa ulang</button>
    </div>
    <${Err}>${s.error}<//>
  <//>`;
}

function AiPanel({ api }) {
  const [text, setText] = useState("halo dunia");
  const [s, run] = useAction(() => request(joinUrl(api, `/api/proses_ai?input=${encodeURIComponent(text)}`)));
  const d = s.data;
  const r = d?.ok ? d.data : null;
  return html`<${Card} title="Proses AI (asyncio.gather)" sub="Random Forest (0.3 dtk) dan SVM (0.5 dtk) dijalankan bersamaan. Total ≈ 0.5 dtk, bukan 0.8 dtk.">
    <div className="row">
      <label>Input teks<input value=${text} onInput=${(e) => setText(e.target.value)} /></label>
      <button onClick=${run} disabled=${s.loading || !text.trim()}>${s.loading ? "Memproses…" : "Proses"}</button>
    </div>
    <${Err}>${s.error || (d && !d.ok && `Error ${d.status}: ${JSON.stringify(d.data)}`)}<//>
    ${r && html`
      <div className="stats">
        <${Stat} label="elapsed (server)" value=${r.elapsed_s + " s"} />
        <${Stat} label="jika berurutan" value="0.8 s" />
        <${Stat} label="round-trip (browser)" value=${Math.round(d.ms) + " ms"} />
      </div>
      <${Timeline} bars=${[
        { label: r.results.model_a.model, start: 0, end: r.results.model_a.delay_s, color: "var(--bar-a)" },
        { label: r.results.model_b.model, start: 0, end: r.results.model_b.delay_s, color: "var(--bar-b)" },
      ]} />
      <${Json} data=${r} />`}
  <//>`;
}

function ConcurrencyPanel({ api }) {
  const [n, setN] = useState(8);
  const [delay, setDelay] = useState(1);
  const [mode, setMode] = useState("async-task");

  const [burst, runBurst] = useAction(async () => {
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: n }, () => request(joinUrl(api, `/api/${mode}?delay=${delay}`)))
    );
    const bad = results.find((x) => !x.ok);
    if (bad) throw new Error(`Error ${bad.status}: ${JSON.stringify(bad.data)}`);
    const jobs = results.map((x) => x.data);
    return { jobs, total: (performance.now() - t0) / 1000, ...countOverlaps(jobs), pids: new Set(jobs.map((j) => j.pid)).size };
  });

  const [fan, runFan] = useAction(async () => {
    const res = await request(joinUrl(api, `/api/fan-out?n=${n}&delay=${delay}`));
    if (!res.ok) throw new Error(`Error ${res.status}: ${JSON.stringify(res.data)}`);
    return res.data;
  });

  const b = burst.data;
  const t0 = b ? Math.min(...b.jobs.map((j) => j.started_at)) : 0;
  const f = fan.data;
  return html`<${Card} title="Uji konkurensi" sub="Kirim N request sekaligus. Async: total ≈ delay. Blocking: total ≈ N × delay (jika satu proses).">
    <div className="row">
      <label>Jumlah request (N)<input type="number" min="1" max="30" value=${n} onInput=${(e) => setN(Math.max(1, Math.min(30, +e.target.value || 1)))} /></label>
      <label>Delay (detik)<input type="number" min="0" max="5" step="0.5" value=${delay} onInput=${(e) => setDelay(Math.max(0, Math.min(5, +e.target.value || 0)))} /></label>
      <label>Endpoint
        <select value=${mode} onChange=${(e) => setMode(e.target.value)} style=${{ padding: 8 }}>
          <option value="async-task">/api/async-task</option>
          <option value="blocking-task">/api/blocking-task</option>
        </select>
      </label>
    </div>
    <div className="row" style=${{ marginTop: 10 }}>
      <button onClick=${runBurst} disabled=${burst.loading}>${burst.loading ? "Mengirim…" : "Kirim N request"}</button>
      <button className="ghost" onClick=${runFan} disabled=${fan.loading}>${fan.loading ? "Memproses…" : "Jalankan fan-out"}</button>
    </div>
    <${Err}>${burst.error}<//><${Err}>${fan.error}<//>
    ${b && html`
      <div className="stats">
        <${Stat} label="total waktu" value=${b.total.toFixed(2) + " s"} />
        <${Stat} label="jika berurutan" value=${(n * delay).toFixed(1) + " s"} />
        <${Stat} label="pasangan tumpang-tindih" value=${b.overlap + "/" + b.pairs} />
        <${Stat} label="instance (pid berbeda)" value=${b.pids} />
      </div>
      <${Timeline} bars=${b.jobs.map((j, i) => ({ label: "req " + (i + 1), start: j.started_at - t0, end: j.finished_at - t0, color: "var(--bar-c)" }))} />`}
    ${f && html`
      <div className="stats">
        <${Stat} label="fan-out: total" value=${f.actual_total_s + " s"} />
        <${Stat} label="fan-out: speedup" value=${f.speedup + "×"} />
        <${Stat} label="estimasi serial" value=${f.sequential_estimate_s + " s"} />
      </div>`}
  <//>`;
}

function WebhookPanel({ hook }) {
  const [secret, setSecret] = useState("");
  const [table, setTable] = useState("orders");
  const [record, setRecord] = useState('{\n  "id": 1,\n  "item": "Kopi",\n  "qty": 2\n}');
  const [s, run] = useAction(async (wrongSig) => {
    let parsed;
    try { parsed = JSON.parse(record); } catch { throw new Error("Record bukan JSON yang valid."); }
    if (!secret) throw new Error("Isi WEBHOOK_SECRET dulu.");
    const body = JSON.stringify({ type: "INSERT", table, schema: "public", record: parsed });
    const sig = await hmacHex(wrongSig ? secret + "x" : secret, body);
    return request(joinUrl(hook, "/api/webhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": "sha256=" + sig },
      body,
    });
  });
  const d = s.data;
  return html`<${Card} title="Webhook Supabase → Telegram" sub="Menandatangani payload dengan HMAC-SHA256 di browser, lalu POST ke /api/webhook. Pesan masuk ke Telegram jika valid.">
    <div className="row">
      <label>WEBHOOK_SECRET (tidak disimpan)<input type="password" value=${secret} onInput=${(e) => setSecret(e.target.value)} autoComplete="off" /></label>
      <label>Tabel<input value=${table} onInput=${(e) => setTable(e.target.value)} /></label>
    </div>
    <label style=${{ marginTop: 10 }}>Record (JSON)<textarea value=${record} onInput=${(e) => setRecord(e.target.value)} /></label>
    <div className="row" style=${{ marginTop: 10 }}>
      <button onClick=${() => run(false)} disabled=${s.loading}>Kirim (signature benar)</button>
      <button className="ghost" onClick=${() => run(true)} disabled=${s.loading}>Kirim (signature salah → 401)</button>
    </div>
    <${Err}>${s.error}<//>
    ${d && html`<div style=${{ marginTop: 12 }}>
      <span className=${"badge " + (d.ok ? "ok" : "bad")}>HTTP ${d.status}</span>
      <${Json} data=${d.data} /></div>`}
  <//>`;
}

/* ---------- aplikasi ---------- */
function App() {
  const [api, setApi] = useSaved("apiBase", "http://127.0.0.1:8000");
  const [hook, setHook] = useSaved("hookBase", "");
  return html`<div className="wrap">
    <h1>Integrated Web Dashboard</h1>
    <p className="sub">Frontend untuk API FastAPI dan webhook Supabase → Vercel → Telegram.</p>
    <div className="card">
      <div className="row">
        <label>URL API FastAPI<input value=${api} onInput=${(e) => setApi(e.target.value.trim())} placeholder="https://api-anda.vercel.app" /></label>
        <label>URL Webhook (Node.js)<input value=${hook} onInput=${(e) => setHook(e.target.value.trim())} placeholder="https://webhook-anda.vercel.app" /></label>
      </div>
    </div>
    <${Flow} />
    <${HealthPanel} api=${api} />
    <${AiPanel} api=${api} />
    <${ConcurrencyPanel} api=${api} />
    <${WebhookPanel} hook=${hook} />
  </div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
