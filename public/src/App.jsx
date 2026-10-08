import { useEffect, useState } from "react";
import {
  Bot,
  LayoutDashboard,
  Monitor,
  Moon,
  Send,
  Settings,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { Field, StatusBadge } from "./components/ui";
import AiPanel from "./panels/AiPanel";
import ConcurrencyPanel from "./panels/ConcurrencyPanel";
import Overview from "./panels/Overview";
import WebhookPanel from "./panels/WebhookPanel";
import { useReachability, useSaved, useTheme } from "./lib/hooks";

const TABS = [
  { id: "overview", label: "Ringkasan", icon: LayoutDashboard },
  { id: "ai", label: "Proses AI", icon: Bot },
  { id: "concurrency", label: "Konkurensi", icon: Zap },
  { id: "webhook", label: "Webhook", icon: Send },
];

const THEMES = [
  { id: "system", icon: Monitor, label: "Ikuti sistem" },
  { id: "light", icon: Sun, label: "Terang" },
  { id: "dark", icon: Moon, label: "Gelap" },
];

function SettingsDialog({ open, onClose, api, setApi, hook, setHook }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h2>Pengaturan</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          Alamat layanan yang sudah di-deploy. Tersimpan di browser ini.
        </p>
        <Field
          label="URL API FastAPI"
          hint="contoh: https://api-anda.vercel.app"
        >
          <input
            value={api}
            onChange={(e) => setApi(e.target.value.trim())}
            placeholder="https://..."
            autoFocus
          />
        </Field>
        <Field
          label="URL Webhook Node.js"
          hint="contoh: https://webhook-anda.vercel.app"
        >
          <input
            value={hook}
            onChange={(e) => setHook(e.target.value.trim())}
            placeholder="https://..."
          />
        </Field>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useSaved("tab", "overview");
  const [api, setApi] = useSaved(
    "apiBase",
    import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000",
  );
  const [hook, setHook] = useSaved(
    "hookBase",
    import.meta.env.VITE_WEBHOOK_URL ?? "",
  );
  const [theme, setTheme] = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiState] = useReachability(api, "/api/health");
  const [hookState] = useReachability(hook, "/api/webhook");

  const nextTheme =
    THEMES[(THEMES.findIndex((t) => t.id === theme) + 1) % THEMES.length];
  const ThemeIcon = THEMES.find((t) => t.id === theme)?.icon ?? Monitor;
  const active = TABS.some((t) => t.id === tab) ? tab : "overview";

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="logo">IW</span>
            <span>Integrated Web(Supabase - Vercel - Telegram)</span>
          </div>
          <nav className="tabs" aria-label="Navigasi utama">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`tab ${active === id ? "tab-active" : ""}`}
                onClick={() => setTab(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="topbar-actions">
            <span className="status-pair" title="Status layanan">
              <StatusBadge status={apiState.status} />
            </span>
            <button
              className="icon-btn"
              onClick={() => setTheme(nextTheme.id)}
              title={`Tema: ${THEMES.find((t) => t.id === theme)?.label}. Klik untuk ${nextTheme.label}`}
            >
              <ThemeIcon size={18} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setSettingsOpen(true)}
              title="Pengaturan"
              aria-label="Pengaturan"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {active === "overview" && (
          <Overview
            api={api}
            hook={hook}
            apiState={apiState}
            hookState={hookState}
            go={setTab}
          />
        )}
        {active === "ai" && <AiPanel api={api} />}
        {active === "concurrency" && <ConcurrencyPanel api={api} />}
        {active === "webhook" && <WebhookPanel hook={hook} />}
      </main>

      <footer className="footer">
        Supabase → Vercel → Telegram · FastAPI + Node.js + React
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        api={api}
        setApi={setApi}
        hook={hook}
        setHook={setHook}
      />
    </>
  );
}
