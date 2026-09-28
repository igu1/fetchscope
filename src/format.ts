const thisPkgDir = "fetchscope";

/** Pull the first app-level call site out of a stack. */
export function getCallSite(): string | undefined {
  const err = new Error();
  const lines = (err.stack ?? "").split("\n");
  for (const line of lines) {
    if (!line.includes("at ")) continue;
    if (line.includes("node:internal")) continue;
    if (line.includes("fetchscope/src/") || line.includes("fetchscope/dist/")) continue;
    if (line.includes("node_modules")) continue;
    if (line.includes("<anonymous>")) continue;

    const match = line.match(
      /at\s+(?:.*?\s)?\(?([^\s()]+\.(?:ts|tsx|js|jsx|mjs|cjs))(?:\?[^\s()]*)?:(\d+):(\d+)\)?/,
    );
    if (match) return `${match[1]}:${match[2]}:${match[3]}`;
  }
  return undefined;
}

const color = typeof process !== "undefined" && process.stderr?.isTTY === true;
export const c = {
  blue: (s: string) => (color ? `\x1b[36m${s}\x1b[0m` : s),
  yellow: (s: string) => (color ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s: string) => (color ? `\x1b[90m${s}\x1b[0m` : s),
} as const;

let output: NonNullable<import("./types").WhyCallConfig["output"]> = "console";
const buffer: string[] = [];

export function configureOutput(next: NonNullable<import("./types").WhyCallConfig["output"]>): void {
  output = next;
}

export function emit(message: string): void {
  if (output === "console") console.error(message);
  else if (output === "buffer") buffer.push(message);
  else if (typeof output === "function") output(message);
}

export function readBuffer(): string[] {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer.length = 0;
}

export function ms(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}s`;
  return `${Math.round(value * 10) / 10}ms`;
}

export function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 10.24) / 100} KB`;
  return `${Math.round(value / 10485.76) / 100} MB`;
}

/**
 *  🌐 GET /api/products
 *     ProductList.tsx:42 — 182ms
 */
export function formatRequest(method: string, url: string, durationMs: number, where?: string): string {
  return `${c.blue(`🌐 ${method} ${url}`)}\n   ${where ?? "(unknown source)"} — ${ms(durationMs)}`;
}

/**
 *  ⚠ Duplicate request
 *  GET /api/products — 4 times within 52ms
 *  ProductList.tsx:42, Sidebar.tsx:18
 */
export function formatDuplicate(method: string, url: string, count: number, windowMs: number, where: string[]): string {
  return [
    c.yellow(`⚠ duplicate request — ${method} ${url}`),
    `${count} times within ${ms(windowMs)}`,
    `sources: ${[...new Set(where)].slice(0, 4).join(", ")}`,
  ].join("\n");
}

/**  🐌 GET /api/dashboard — 842ms */
export function formatSlow(method: string, url: string, durationMs: number): string {
  return c.red(`🐌 slow request — ${method} ${url} took ${ms(durationMs)}`);
}

/**  ⚠ big payload — GET /api/products: 2.4 MB */
export function formatLargePayload(method: string, url: string, size: string): string {
  return c.yellow(`⚠ big payload — ${method} ${url}: ${size}`);
}
