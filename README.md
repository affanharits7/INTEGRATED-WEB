# Async Serverless Function — FastAPI

## Struktur
```
api/index.py          # aplikasi FastAPI (entry serverless; Vercel / AWS Lambda via Mangum)
api/logic.py          # logika async (asyncio.sleep, asyncio.gather)
test_concurrency.py   # uji & bukti konkurensi (stdlib saja)
result.json           # hasil uji yang sudah dijalankan
vercel.json, requirements.txt
```

## Endpoint (semua respons JSON)
| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | cek status |
| `GET /api/async-task?delay=1` | I/O non-blocking (`await asyncio.sleep`) |
| `GET /api/blocking-task?delay=1` | pembanding anti-pattern (`time.sleep` di `async def`) |
| `GET /api/fan-out?n=10&delay=1` | n sub-job paralel dalam 1 request (`asyncio.gather`) |

## Jalankan & uji lokal
```bash
pip install -r requirements.txt
uvicorn api.index:app --port 8000 --workers 1
# terminal lain:
python test_concurrency.py -n 10 -d 1
```
`--workers 1` sengaja dipakai: konkurensi berasal dari event loop, bukan dari banyak proses.

## Deploy
- **Vercel**: `vercel deploy` → uji: `python test_concurrency.py https://<app>.vercel.app --skip-blocking`
- **AWS Lambda**: handler `api.index.handler`

Catatan: di platform serverless, request bersamaan bisa dilayani oleh banyak instance
(`distinct_pids` > 1). Bukti event-loop murni paling jelas di uji lokal 1 worker;
`/api/fan-out` tetap membuktikan konkurensi di dalam satu invocation di platform mana pun.
