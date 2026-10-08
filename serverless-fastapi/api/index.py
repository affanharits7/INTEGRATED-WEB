"""
Serverless function FastAPI.

- Vercel   : file ini otomatis jadi function (lihat vercel.json), objek `app` dipakai langsung.
- AWS Lambda: set handler ke `api.index.handler` (Mangum adapter).
- Lokal    : uvicorn api.index:app --port 8000
"""
import asyncio
import time

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:  # pakai package-relative import saat dijalankan sebagai modul
    from . import logic
except ImportError:  # Vercel memuat file ini sebagai script
    import logic  # type: ignore

app = FastAPI(title="Async Serverless Demo", version="1.0.0")
# Frontend (domain berbeda) hanya perlu GET; API publik tanpa cookie/kredensial.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


class TaskResponse(BaseModel):
    status: str
    mode: str
    request_id: str
    delay_s: float
    started_at: float
    finished_at: float
    elapsed_s: float
    pid: int
    thread: int


@app.get("/api")
async def index():
    return {"status": "ok"}

@app.get("/api/proses_ai")
async def proses_ai(input_text: str = Query(..., alias="input", min_length=1)):
    start = time.time()
    model_a, model_b = await asyncio.gather(
        logic.model_a_random_forest(input_text),
        logic.model_b_svm(input_text),
    )
    end = time.time()
    return {
        "status": "success",
        "input": input_text,
        "results": {"model_a": model_a, "model_b": model_b},
        "started_at": round(start, 4),
        "finished_at": round(end, 4),
        "elapsed_s": round(end - start, 3),  # ≈ 0.5 (paralel), bukan 0.8 (serial)
    }


@app.get("/api/async-task", response_model=TaskResponse)
async def async_task(delay: float = Query(1.0, ge=0, le=10)):
    return await logic.async_task(delay)


@app.get("/api/blocking-task", response_model=TaskResponse)
async def blocking_task(delay: float = Query(1.0, ge=0, le=10)):
    return await logic.blocking_task(delay)


@app.get("/api/fan-out")
async def fan_out(n: int = Query(5, ge=1, le=100), delay: float = Query(1.0, ge=0, le=10)):
    return await logic.fan_out(n, delay)


@app.exception_handler(Exception)
async def on_error(_, exc: Exception):
    return JSONResponse(status_code=500, content={"status": "error", "detail": str(exc)})


# Adapter AWS Lambda (opsional; abaikan jika deploy ke Vercel)
try:
    from mangum import Mangum

    handler = Mangum(app)
except ImportError:
    handler = None
