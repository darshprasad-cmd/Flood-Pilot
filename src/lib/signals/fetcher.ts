/**
 * Thin wrapper around `fetch` for upstream signal APIs.
 *
 * Two rules the rest of the codebase relies on:
 *   1. It never throws. A failed upstream degrades the prediction's confidence,
 *      it does not take down the page.
 *   2. It never hangs. A slow weather API must not hold a route calculation
 *      open, so every call is on a hard timeout.
 */

export interface FetchOptions {
  /** Seconds Next.js should cache the response for. */
  revalidate: number;
  timeoutMs?: number;
  label: string;
}

export interface FetchResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
  latencyMs: number;
}

export async function fetchJson<T>(
  url: string,
  { revalidate, timeoutMs = 6000, label }: FetchOptions,
): Promise<FetchResult<T>> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        error: `${label}: upstream returned ${res.status}`,
        latencyMs: Date.now() - started,
      };
    }

    const data = (await res.json()) as T;
    return { ok: true, data, latencyMs: Date.now() - started };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      data: null,
      error: aborted
        ? `${label}: timed out after ${timeoutMs}ms`
        : `${label}: ${err instanceof Error ? err.message : "unknown error"}`,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Open-Meteo returns an object for one coordinate and an array for many. */
export function asArray<T>(payload: T | T[] | null): T[] {
  if (payload === null) return [];
  return Array.isArray(payload) ? payload : [payload];
}

/** Open-Meteo emits local naive timestamps; we always request GMT. */
export function parseUtc(stamp: string): number {
  return Date.parse(stamp.endsWith("Z") ? stamp : `${stamp}Z`);
}
