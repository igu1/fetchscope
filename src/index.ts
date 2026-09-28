import {
  bytes,
  c,
  clearBuffer,
  configureOutput,
  emit,
  formatDuplicate,
  formatLargePayload,
  formatRequest,
  formatSlow,
  getCallSite,
  readBuffer,
} from "./format";
import type { RequestRecord, WhyCallConfig } from "./types";

/* ------------------------------------------------------------- config --- */

const DEFAULTS: Required<Pick<WhyCallConfig, "slowRequestMs" | "largePayloadKb" | "duplicateWindow">> = {
  slowRequestMs: 500,
  largePayloadKb: 500,
  duplicateWindow: 100,
};

let config: WhyCallConfig = { ...DEFAULTS };
let now: () => number = () => Date.now();

export function configureWhyFetch(options: WhyCallConfig): void {
  config = { ...config, ...options };
  if (options.output) configureOutput(options.output);
  if (options.now) now = options.now;
}

export function bufferedMessages(): string[] {
  return readBuffer();
}

export function resetBuffer(): void {
  clearBuffer();
}

/* -------------------------------------------------------------- state --- */

const originalFetch = {
  value: undefined as typeof globalThis.fetch | undefined,
  installed: false,
};

const seen = new Map<string, { count: number; sources: string[]; windowStart: number }>();

const perUrlStats = new Map<string, { count: number; totalMs: number }>();

/** Clear all recorded state (stats, duplicates). */
export function resetWhyCall(): void {
  seen.clear();
  perUrlStats.clear();
}

export function statsFor(urlSubstring: string): { count: number; avgMs: number } {
  let count = 0;
  let totalMs = 0;
  for (const [url, s] of perUrlStats) {
    if (!url.includes(urlSubstring)) continue;
    count += s.count;
    totalMs += s.totalMs;
  }
  return { count, avgMs: count > 0 ? totalMs / count : 0 };
}

function isIgnored(url: string): boolean {
  for (const pattern of config.ignore ?? []) {
    if (typeof pattern === "string" ? url.includes(pattern) : pattern.test(url)) return true;
  }
  return false;
}

/* -------------------------------------------------------------- patch --- */

export function installWhyFetch(instant = true): void {
  if (originalFetch.installed) return;

  const target = globalThis.fetch;
  if (!target) return;

  originalFetch.value = target;
  originalFetch.installed = true;

  const wrapped = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const source = getCallSite();

    if (isIgnored(url)) {
      return target(input as RequestInfo, init);
    }
    const startedAt = now();
    const response = await target(input as RequestInfo, init);
    const finishedAt = now();
    const durationMs = finishedAt - startedAt;

    const contentLengthHeader = response.headers.get("content-length");
    const payloadBytes = contentLengthHeader ? Number(contentLengthHeader) : undefined;

    const rec: RequestRecord = {
      url,
      method,
      durationMs,
      source,
      payloadBytes,
      startedAt,
      finishedAt,
    };
    record(rec);

    return response;
  };

  globalThis.fetch = wrapped as typeof globalThis.fetch;
  void instant;
}

function record(rec: RequestRecord): void {
  emit(formatRequest(rec.method, rec.url, rec.durationMs, rec.source));

  // duplicate detection inside a sliding window
  if ((config.duplicateWindow ?? 0) > 0) {
    const key = `${rec.method} ${rec.url}`;
    const t = now();
    const state = seen.get(key) ?? { count: 0, sources: [], windowStart: t };
    const inWindow = t - state.windowStart <= (config.duplicateWindow ?? 0);
    if (!inWindow) {
      state.count = 0;
      state.sources = [];
      state.windowStart = t;
    }
    state.count += 1;
    if (rec.source) state.sources.push(rec.source);
    seen.set(key, state);
    if (state.count > 1) {
      emit(formatDuplicate(rec.method, rec.url, state.count, t - state.windowStart, state.sources));
    }
  }

  if (rec.durationMs >= (config.slowRequestMs ?? Infinity)) {
    emit(formatSlow(rec.method, rec.url, rec.durationMs));
  }

  if (rec.payloadBytes !== undefined && (rec.payloadBytes ?? 0) > (config.largePayloadKb ?? Infinity) * 1024) {
    emit(formatLargePayload(rec.method, rec.url, bytes(rec.payloadBytes)));
  }

  const urlKey = rec.url.split("?")[0];
  const s = perUrlStats.get(urlKey) ?? { count: 0, totalMs: 0 };
  s.count += 1;
  s.totalMs += rec.durationMs;
  perUrlStats.set(urlKey, s);
}

/** Restore the original fetch. */
export function uninstallWhyFetch(): void {
  if (!originalFetch.installed) return;
  if (originalFetch.value) {
    globalThis.fetch = originalFetch.value;
  }
  originalFetch.installed = false;
  originalFetch.value = undefined;
}

/** opt-in one-liner wrapper that also logs what it did. */
export function whyFetch(input: URL | RequestInfo, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init as RequestInit);
}
