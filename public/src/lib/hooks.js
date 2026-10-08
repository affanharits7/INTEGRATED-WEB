import { useCallback, useEffect, useState } from "react";
import { friendlyError, joinUrl, request } from "./api";

export function useSaved(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* penyimpanan tidak tersedia, abaikan */
    }
  }, [key, value]);
  return [value, setValue];
}

export function useTheme() {
  const [theme, setTheme] = useSaved("theme", "system");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

export function useAction(fn) {
  const [state, setState] = useState({ loading: false });
  const run = useCallback(
    async (...args) => {
      setState((s) => ({ ...s, loading: true, error: undefined }));
      try {
        setState({ loading: false, data: await fn(...args) });
      } catch (e) {
        setState({ loading: false, error: friendlyError(e) });
      }
    },
    [fn]
  );
  return [state, run];
}

/** Memeriksa layanan secara berkala. Status HTTP < 500 dianggap terjangkau. */
export function useReachability(base, path, intervalMs = 30000) {
  const [state, setState] = useState({ status: "idle" });
  const check = useCallback(async () => {
    if (!base?.trim()) return setState({ status: "idle" });
    setState((s) => ({ ...s, status: "checking" }));
    try {
      const r = await request(joinUrl(base, path));
      setState({ status: r.status < 500 ? "online" : "offline", ms: r.ms });
    } catch {
      setState({ status: "offline" });
    }
  }, [base, path]);
  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);
  return [state, check];
}
