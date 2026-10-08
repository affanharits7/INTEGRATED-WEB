# Supabase → Vercel → Telegram

`POST /api/webhook` menerima event dari Supabase, memverifikasi HMAC-SHA256, lalu meneruskannya ke Telegram.

## Cara kerja
1. Supabase mengirim JSON `{type, table, schema, record, old_record}` dengan header `x-signature: sha256=<hex>`.
2. Server menghitung `HMAC-SHA256(body mentah, WEBHOOK_SECRET)` dan membandingkannya (constant-time).
3. Tidak cocok → `401`. Cocok → pesan dikirim ke Telegram → `200`.

Kode status: `405` bukan POST, `401` signature salah, `400` JSON rusak, `413` body > 100 KB, `502` Telegram gagal, `500` env belum lengkap.

## Environment variable
Lihat `.env.example`. Isi di Vercel → Settings → Environment Variables (jangan di-commit).

## Telegram
1. `@BotFather` → `/newbot` → simpan token.
2. Kirim pesan ke bot, buka `https://api.telegram.org/bot<TOKEN>/getUpdates`, ambil `chat.id`.

## Supabase
Webhook bawaan dashboard tidak bisa menghitung HMAC, jadi pakai trigger + `pg_net`.
Jalankan di SQL Editor (ganti URL dan secret):

```sql
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.notify_webhook() returns trigger
language plpgsql security definer as $$
declare
  payload text;
  sig text;
begin
  payload := json_build_object(
    'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA,
    'record', case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    'old_record', case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end
  )::text;
  sig := encode(extensions.hmac(payload, 'ISI_SAMA_DENGAN_WEBHOOK_SECRET', 'sha256'), 'hex');
  perform net.http_post(
    url := 'https://<project>.vercel.app/api/webhook',
    body := payload::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-signature', 'sha256=' || sig)
  );
  return coalesce(NEW, OLD);
end $$;

create trigger orders_webhook after insert on public.orders
for each row execute function public.notify_webhook();
```

Catatan: `payload::jsonb` membuat `pg_net` mengirim ulang JSON dengan susunan key/spasi sendiri,
yang bisa berbeda dari string yang di-HMAC. Jika tanda tangan ditolak, ganti ke
`body := payload::jsonb` → kirim sebagai teks mentah (lihat dokumentasi `net.http_post` versi Anda)
atau hitung HMAC dari `payload::jsonb::text`.

## Uji
```bash
npm test                      # uji lokal (fetch Telegram di-mock)
```
Uji produksi dengan curl:
```bash
BODY='{"type":"INSERT","table":"orders","schema":"public","record":{"id":1}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -X POST https://<project>.vercel.app/api/webhook \
  -H "Content-Type: application/json" -H "x-signature: sha256=$SIG" -d "$BODY"
```

## Deploy
Push ke GitHub → Import di vercel.com/new (Framework: Other) → isi env var → Deploy.
