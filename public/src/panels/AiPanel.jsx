import { useState } from "react";
import { Bot, Play } from "lucide-react";
import { Button, ErrorNote, Field, JsonView, Panel, Stat, Timeline } from "../components/ui";
import { joinUrl, request } from "../lib/api";
import { useAction } from "../lib/hooks";

export default function AiPanel({ api }) {
  const [text, setText] = useState("Pelayanan di toko ini sangat memuaskan");
  const [state, run] = useAction(async () => {
    const res = await request(joinUrl(api, `/api/proses_ai?input=${encodeURIComponent(text)}`));
    if (!res.ok) throw new Error(`Error ${res.status}: ${JSON.stringify(res.data)}`);
    return res;
  });
  const res = state.data;
  const r = res?.data;

  return (
    <Panel
      icon={Bot}
      title="Proses AI"
      description="Dua model disimulasikan berjalan bersamaan dengan asyncio.gather: Random Forest 0,3 detik dan SVM 0,5 detik."
    >
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Field label="Input teks">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ketik teks apa saja" />
        </Field>
        <Button type="submit" icon={Play} loading={state.loading} disabled={!text.trim()}>
          Jalankan
        </Button>
      </form>
      <ErrorNote>{state.error}</ErrorNote>

      {r && (
        <div className="result">
          <div className="stats">
            <Stat label="Waktu server" value={`${r.elapsed_s} s`} tone="ok" sub="paralel (gather)" />
            <Stat label="Jika berurutan" value="0.8 s" sub="0.3 + 0.5" />
            <Stat label="Hemat" value={`${Math.max(0, Math.round((1 - r.elapsed_s / 0.8) * 100))}%`} tone="ok" />
            <Stat label="Round-trip browser" value={`${Math.round(res.ms)} ms`} sub="termasuk jaringan" />
          </div>
          <Timeline
            caption="Kedua model mulai bersamaan; total waktu mengikuti model paling lambat."
            bars={[
              { label: "Random Forest", start: 0, end: r.results.model_a.delay_s, color: "var(--c1)" },
              { label: "SVM", start: 0, end: r.results.model_b.delay_s, color: "var(--c2)" },
            ]}
          />
          <JsonView data={r} />
        </div>
      )}
    </Panel>
  );
}
