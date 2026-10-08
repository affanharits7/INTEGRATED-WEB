import { ArrowRight, Bot, Database, Globe, LayoutDashboard, Send, Server, Webhook } from "lucide-react";
import { Panel, StatusBadge } from "../components/ui";

const Node = ({ icon: Icon, title, sub, tone }) => (
  <div className={`flow-node flow-${tone}`}>
    <Icon size={22} />
    <strong>{title}</strong>
    <span>{sub}</span>
  </div>
);

const Arrow = () => (
  <span className="flow-arrow" aria-hidden="true">
    <ArrowRight size={20} />
  </span>
);

function ServiceCard({ icon: Icon, name, tech, url, state, endpoints }) {
  return (
    <div className="service">
      <div className="service-top">
        <span className="panel-icon">
          <Icon size={18} />
        </span>
        <div>
          <strong>{name}</strong>
          <span className="muted">{tech}</span>
        </div>
        <StatusBadge status={state.status} ms={state.ms} />
      </div>
      <code className="service-url">{url || "URL belum diisi"}</code>
      <ul className="endpoints">
        {endpoints.map(([method, path]) => (
          <li key={path}>
            <span className={`method method-${method.toLowerCase()}`}>{method}</span>
            <code>{path}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Overview({ api, hook, apiState, hookState, go }) {
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">Serverless · Vercel</span>
          <h1>Integrated Web</h1>
          <p>
            Satu dashboard untuk dua layanan serverless: API Python yang membuktikan konkurensi asinkron, dan
            webhook Node.js yang meneruskan kejadian dari Supabase ke Telegram.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => go("ai")}>
              <Bot size={16} /> Coba Proses AI
            </button>
            <button className="btn btn-ghost" onClick={() => go("webhook")}>
              <Send size={16} /> Uji Webhook
            </button>
          </div>
        </div>
      </div>

      <Panel icon={LayoutDashboard} title="Arsitektur" description="Alur data antar layanan.">
        <div className="flow">
          <Node icon={Globe} title="Frontend" sub="React + Vite" tone="a" />
          <Arrow />
          <Node icon={Server} title="API FastAPI" sub="Python · asyncio" tone="b" />
        </div>
        <div className="flow">
          <Node icon={Database} title="Supabase" sub="Trigger + pg_net" tone="c" />
          <Arrow />
          <Node icon={Webhook} title="Webhook" sub="Node.js · HMAC-SHA256" tone="a" />
          <Arrow />
          <Node icon={Send} title="Telegram" sub="Bot API" tone="b" />
        </div>
      </Panel>

      <div className="grid-2">
        <ServiceCard
          icon={Server}
          name="API FastAPI"
          tech="Python · Vercel Function"
          url={api}
          state={apiState}
          endpoints={[
            ["GET", "/api/health"],
            ["GET", "/api/proses_ai?input="],
            ["GET", "/api/async-task"],
            ["GET", "/api/blocking-task"],
            ["GET", "/api/fan-out"],
          ]}
        />
        <ServiceCard
          icon={Webhook}
          name="Webhook Telegram"
          tech="Node.js · Vercel Function"
          url={hook}
          state={hookState}
          endpoints={[["POST", "/api/webhook"]]}
        />
      </div>
    </>
  );
}
