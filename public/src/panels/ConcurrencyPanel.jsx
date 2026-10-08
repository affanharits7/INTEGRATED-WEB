import { useState } from "react";
import { GitCompare, Layers, Zap } from "lucide-react";
import { Button, ErrorNote, Field, Panel, Stat, Timeline } from "../components/ui";
import { countOverlaps, joinUrl, request } from "../lib/api";
import { useAction } from "../lib/hooks";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

async function burst(api, mode, n, delay) {
  const t0 = performance.now();
  const results = await Promise.all(
    Array.from({ length: n }, () => request(joinUrl(api, `/api/${mode}?delay=${delay}`)))
  );
  const bad = results.find((x) => !x.ok);
  if (bad) throw new Error(`Error ${bad.status}: ${JSON.stringify(bad.data)}`);
  const jobs = results.map((x) => x.data);
  return {
    jobs,
    total: (performance.now() - t0) / 1000,
    pids: new Set(jobs.map((j) => j.pid)).size,
    ...countOverlaps(jobs),
  };
}

function BurstResult({ title, mode, n, delay, data, color }) {
  const origin = Math.min(...data.jobs.map((j) => j.started_at));
  return (
    <div className="subcard">
      <h3>{title}</h3>
      <div className="stats stats-compact">
        <Stat label="Total waktu" value={`${data.total.toFixed(2)} s`} tone={mode === "async-task" ? "ok" : "bad"} />
        <Stat label="Jika berurutan" value={`${(n * delay).toFixed(1)} s`} />
        <Stat label="Tumpang-tindih" value={`${data.overlap}/${data.pairs}`} sub="pasangan request" />
        <Stat label="Instance" value={data.pids} sub="pid berbeda" />
      </div>
      <Timeline
        bars={data.jobs.map((j, i) => ({
          label: `req ${i + 1}`,
          start: j.started_at - origin,
          end: j.finished_at - origin,
          color,
        }))}
      />
    </div>
  );
}

export default function ConcurrencyPanel({ api }) {
  const [n, setN] = useState(8);
  const [delay, setDelay] = useState(1);

  const [cmp, runCmp] = useAction(async () => {
    const asyncRes = await burst(api, "async-task", n, delay);
    const blockingRes = await burst(api, "blocking-task", n, delay);
    return { asyncRes, blockingRes, n, delay };
  });

  const [fan, runFan] = useAction(async () => {
    const res = await request(joinUrl(api, `/api/fan-out?n=${n}&delay=${delay}`));
    if (!res.ok) throw new Error(`Error ${res.status}: ${JSON.stringify(res.data)}`);
    return res.data;
  });

  const c = cmp.data;
  const f = fan.data;

  return (
    <Panel
      icon={Zap}
      title="Uji Konkurensi"
      description="Kirim N request sekaligus. Endpoint async melepas event loop sehingga total waktu ≈ delay; endpoint blocking memblokirnya sehingga ≈ N × delay (pada satu proses)."
    >
      <div className="form-row">
        <Field label="Jumlah request (N)" hint="1 – 30">
          <input type="number" min="1" max="30" value={n} onChange={(e) => setN(clamp(+e.target.value || 1, 1, 30))} />
        </Field>
        <Field label="Delay per request (detik)" hint="0 – 5">
          <input
            type="number"
            min="0"
            max="5"
            step="0.5"
            value={delay}
            onChange={(e) => setDelay(clamp(+e.target.value || 0, 0, 5))}
          />
        </Field>
        <div className="btn-group">
          <Button icon={GitCompare} loading={cmp.loading} onClick={() => runCmp()}>
            Bandingkan async vs blocking
          </Button>
          <Button variant="ghost" icon={Layers} loading={fan.loading} onClick={() => runFan()}>
            Fan-out
          </Button>
        </div>
      </div>
      <ErrorNote>{cmp.error}</ErrorNote>
      <ErrorNote>{fan.error}</ErrorNote>

      {c && (
        <div className="grid-2 result">
          <BurstResult title="Async (asyncio.sleep)" mode="async-task" {...c} data={c.asyncRes} color="var(--c1)" />
          <BurstResult title="Blocking (time.sleep)" mode="blocking-task" {...c} data={c.blockingRes} color="var(--c3)" />
        </div>
      )}
      {c && (
        <p className="footnote">
          Di Vercel, request bersamaan bisa dilayani beberapa instance (kolom Instance &gt; 1), sehingga perbedaan async
          dan blocking paling jelas terlihat saat dijalankan lokal dengan satu worker.
        </p>
      )}

      {f && (
        <div className="subcard result">
          <h3>Fan-out dalam satu request (asyncio.gather)</h3>
          <div className="stats stats-compact">
            <Stat label="Total" value={`${f.actual_total_s} s`} tone="ok" />
            <Stat label="Estimasi serial" value={`${f.sequential_estimate_s} s`} />
            <Stat label="Speedup" value={`${f.speedup}×`} tone="ok" />
            <Stat label="Sub-job" value={f.n} />
          </div>
        </div>
      )}
    </Panel>
  );
}
