"""
Uji & bukti konkurensi — hanya pakai standard library (tanpa install apa pun).

Pemakaian:
    python test_concurrency.py                      # default http://127.0.0.1:8000
    python test_concurrency.py https://app-anda.vercel.app -n 10 -d 1

Yang dibuktikan:
  1. N request ke /api/async-task dikirim bersamaan → total ≈ 1×delay (bukan N×delay),
     dan interval [started_at, finished_at] tiap request SALING TUMPANG-TINDIH.
  2. Pembanding /api/blocking-task → total ≈ N×delay (serial) — jika di 1 proses.
  3. /api/fan-out → asyncio.gather di dalam satu request, speedup ≈ n.
"""
import argparse
import asyncio
import json
import ssl
import sys
import time
from urllib.parse import urlsplit


async def http_get_json(base: str, path: str) -> dict:
    u = urlsplit(base)
    https = u.scheme == "https"
    port = u.port or (443 if https else 80)
    reader, writer = await asyncio.open_connection(
        u.hostname, port, ssl=ssl.create_default_context() if https else None
    )
    writer.write(
        f"GET {path} HTTP/1.1\r\nHost: {u.hostname}\r\nConnection: close\r\n"
        f"Accept: application/json\r\n\r\n".encode()
    )
    await writer.drain()
    raw = await reader.read()
    writer.close()
    head, _, body = raw.partition(b"\r\n\r\n")
    if b"chunked" in head.lower():  # dekode transfer-encoding: chunked
        out, rest = b"", body
        while rest:
            size_line, _, rest = rest.partition(b"\r\n")
            size = int(size_line, 16)
            if size == 0:
                break
            out, rest = out + rest[:size], rest[size + 2:]
        body = out
    return json.loads(body)


def overlap_count(results: list[dict]) -> int:
    """Jumlah pasangan request yang intervalnya beririsan."""
    c = 0
    for i in range(len(results)):
        for j in range(i + 1, len(results)):
            a, b = results[i], results[j]
            if a["started_at"] < b["finished_at"] and b["started_at"] < a["finished_at"]:
                c += 1
    return c


async def burst(base: str, endpoint: str, n: int, delay: float) -> dict:
    t0 = time.perf_counter()
    results = await asyncio.gather(
        *(http_get_json(base, f"{endpoint}?delay={delay}") for _ in range(n))
    )
    total = time.perf_counter() - t0
    pairs = n * (n - 1) // 2
    ov = overlap_count(results)
    return {
        "endpoint": endpoint,
        "requests": n,
        "delay_per_request_s": delay,
        "total_wall_time_s": round(total, 3),
        "serial_estimate_s": round(n * delay, 3),
        "overlapping_pairs": f"{ov}/{pairs}",
        "distinct_pids": len({r["pid"] for r in results}),
        "distinct_threads": len({r["thread"] for r in results}),
        "timeline": sorted(
            ({"id": r["request_id"], "start": r["started_at"], "end": r["finished_at"]} for r in results),
            key=lambda x: x["start"],
        ),
        "_ov": ov,
        "_pairs": pairs,
        "_total": total,
    }


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("base", nargs="?", default="http://127.0.0.1:8000")
    p.add_argument("-n", type=int, default=10, help="jumlah request bersamaan")
    p.add_argument("-d", type=float, default=1.0, help="delay per request (detik)")
    p.add_argument("--skip-blocking", action="store_true")
    a = p.parse_args()

    health = await http_get_json(a.base, "/api/health")
    assert health["status"] == "ok", health

    report = {"target": a.base}
    asy = await burst(a.base, "/api/async-task", a.n, a.d)
    report["async"] = asy
    if not a.skip_blocking:
        report["blocking"] = await burst(a.base, "/api/blocking-task", a.n, a.d)
    fan = await http_get_json(a.base, f"/api/fan-out?n={a.n}&delay={a.d}")
    report["fan_out"] = {k: v for k, v in fan.items() if k != "jobs"}

    # ---- Asersi (bukti) ----
    checks = {
        "async: total < 2×delay (bukan N×delay)": asy["_total"] < 2 * a.d,
        "async: semua interval saling tumpang-tindih": asy["_ov"] == asy["_pairs"],
        "fan_out: speedup > N/2": fan["speedup"] > a.n / 2,
    }
    if "blocking" in report and report["blocking"]["distinct_pids"] == 1:
        b = report["blocking"]
        checks["blocking (1 proses): total ≈ N×delay, tanpa tumpang-tindih"] = (
            b["_total"] >= 0.9 * a.n * a.d and b["_ov"] == 0
        )
    report["checks"] = {k: ("PASS" if v else "FAIL") for k, v in checks.items()}

    for k in ("async", "blocking"):
        if k in report:
            for f in ("_ov", "_pairs", "_total"):
                report[k].pop(f)

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
