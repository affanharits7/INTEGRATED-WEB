"""Hanya untuk uji di lingkungan tanpa FastAPI: route & logika identik (api/logic.py)
disajikan lewat Starlette — engine ASGI yang dipakai FastAPI di balik layar."""
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from api import logic

async def health(r): return JSONResponse({"status": "ok"})
async def a(r): return JSONResponse(await logic.async_task(float(r.query_params.get("delay", 1))))
async def b(r): return JSONResponse(await logic.blocking_task(float(r.query_params.get("delay", 1))))
async def f(r): return JSONResponse(await logic.fan_out(int(r.query_params.get("n", 5)), float(r.query_params.get("delay", 1))))

app = Starlette(routes=[Route("/api/health", health), Route("/api/async-task", a),
                        Route("/api/blocking-task", b), Route("/api/fan-out", f)])
