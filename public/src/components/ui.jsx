import { useState } from "react";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";

export function Panel({ icon: Icon, title, description, children, aside }) {
  return (
    <section className="panel">
      <header className="panel-head">
        {Icon && (
          <span className="panel-icon">
            <Icon size={20} />
          </span>
        )}
        <div className="panel-title">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Button({ children, loading, variant = "primary", icon: Icon, ...props }) {
  return (
    <button className={`btn btn-${variant}`} disabled={loading || props.disabled} {...props}>
      {loading ? <Loader2 size={16} className="spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function Stat({ label, value, tone, sub }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function StatusBadge({ status, ms }) {
  const map = {
    online: ["ok", "Online"],
    offline: ["bad", "Tidak terjangkau"],
    checking: ["wait", "Memeriksa"],
    idle: ["idle", "Belum diatur"],
  };
  const [tone, text] = map[status] ?? map.idle;
  return (
    <span className={`badge badge-${tone}`}>
      <i className="dot" />
      {text}
      {status === "online" && ms != null && <span className="badge-ms">{Math.round(ms)} ms</span>}
    </span>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="note note-bad" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}

export function JsonView({ data, title = "Respons" }) {
  const [copied, setCopied] = useState(false);
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard tidak tersedia */
    }
  };
  return (
    <div className="json">
      <div className="json-bar">
        <span>{title}</span>
        <button type="button" onClick={copy} aria-label="Salin">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

/** bars: [{ label, start, end, color }] dalam satuan detik. */
export function Timeline({ bars, caption }) {
  const min = Math.min(...bars.map((b) => b.start));
  const max = Math.max(...bars.map((b) => b.end));
  const span = max - min || 1;
  return (
    <div className="timeline">
      {caption && <div className="timeline-caption">{caption}</div>}
      {bars.map((b, i) => (
        <div className="tl-row" key={`${b.label}-${i}`}>
          <span className="tl-label">{b.label}</span>
          <div className="tl-track">
            <div
              className="tl-bar"
              style={{
                left: `${((b.start - min) / span) * 100}%`,
                width: `${Math.max(((b.end - b.start) / span) * 100, 0.8)}%`,
                background: b.color,
                animationDelay: `${i * 35}ms`,
              }}
            />
          </div>
          <span className="tl-time">{(b.end - b.start).toFixed(2)}s</span>
        </div>
      ))}
      <div className="tl-axis">
        <span>0 s</span>
        <span>{span.toFixed(2)} s</span>
      </div>
    </div>
  );
}
