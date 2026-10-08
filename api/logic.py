"""
Logika bisnis asynchronous — tidak bergantung pada framework.
Dipakai oleh FastAPI (api/index.py) dan oleh harness uji di sandbox.
"""
import asyncio
import os
import threading
import time
import uuid


def _now() -> float:
    return round(time.time(), 4)


def _runtime_info() -> dict:
    # pid + thread sama di semua respons => semua request dilayani
    # oleh SATU proses & SATU thread (event loop), bukan paralel via thread.
    return {"pid": os.getpid(), "thread": threading.get_ident()}


async def async_task(delay: float) -> dict:
    """Simulasi I/O non-blocking (query DB, panggil API lain, dsb).
    `await asyncio.sleep` melepas event loop sehingga request lain bisa jalan."""
    req_id = uuid.uuid4().hex[:8]
    start = _now()
    await asyncio.sleep(delay)
    end = _now()
    return {
        "status": "success",
        "mode": "async",
        "request_id": req_id,
        "delay_s": delay,
        "started_at": start,
        "finished_at": end,
        "elapsed_s": round(end - start, 3),
        **_runtime_info(),
    }


async def blocking_task(delay: float) -> dict:
    """ANTI-PATTERN untuk pembanding: time.sleep di dalam async def
    memblokir event loop, sehingga request diproses satu per satu."""
    req_id = uuid.uuid4().hex[:8]
    start = _now()
    time.sleep(delay)  # memblokir!
    end = _now()
    return {
        "status": "success",
        "mode": "blocking",
        "request_id": req_id,
        "delay_s": delay,
        "started_at": start,
        "finished_at": end,
        "elapsed_s": round(end - start, 3),
        **_runtime_info(),
    }


async def _sub_job(job_id: int, delay: float) -> dict:
    start = _now()
    await asyncio.sleep(delay)
    return {"job_id": job_id, "started_at": start, "finished_at": _now()}


async def fan_out(n: int, delay: float) -> dict:
    """Konkurensi DI DALAM satu request: n sub-job dijalankan bersamaan
    dengan asyncio.gather. Total waktu ≈ delay, bukan n × delay."""
    start = time.perf_counter()
    jobs = await asyncio.gather(*(_sub_job(i, delay) for i in range(n)))
    total = time.perf_counter() - start
    return {
        "status": "success",
        "mode": "fan_out",
        "jobs": jobs,
        "n": n,
        "delay_per_job_s": delay,
        "sequential_estimate_s": round(n * delay, 3),
        "actual_total_s": round(total, 3),
        "speedup": round((n * delay) / total, 2),
        **_runtime_info(),
    }
