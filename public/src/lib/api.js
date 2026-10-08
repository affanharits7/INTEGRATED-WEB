export const joinUrl = (base, path) => {
  if (!base?.trim()) throw new Error("URL belum diisi. Buka Pengaturan dan isi alamat layanan.");
  return base.trim().replace(/\/+$/, "") + path;
};

export async function request(url, options) {
  const t0 = performance.now();
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data, ms: performance.now() - t0 };
}

export async function hmacHex(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function countOverlaps(jobs) {
  let overlap = 0;
  let pairs = 0;
  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      pairs++;
      if (jobs[i].started_at < jobs[j].finished_at && jobs[j].started_at < jobs[i].finished_at) overlap++;
    }
  }
  return { overlap, pairs };
}

export const friendlyError = (e) =>
  e instanceof TypeError
    ? "Gagal terhubung. Periksa URL, pastikan server aktif dan sudah men-deploy versi dengan CORS."
    : e.message;
