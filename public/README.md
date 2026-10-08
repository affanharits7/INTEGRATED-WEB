# Frontend — React + Vite

Dashboard untuk API FastAPI dan webhook Supabase → Telegram.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # hasil di dist/
```

URL layanan diisi dari menu Pengaturan (tersimpan di browser), atau sebagai nilai awal lewat
`.env` (lihat `.env.example`): `VITE_API_URL`, `VITE_WEBHOOK_URL`.

## Deploy ke Vercel
Root Directory `public`, Framework Preset `Vite` (terdeteksi otomatis). Build: `npm run build`, output: `dist`.
