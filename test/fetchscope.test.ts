import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  configureWhyFetch,
  installWhyFetch,
  uninstallWhyFetch,
  resetWhyCall,
  statsFor,
  bufferedMessages,
  resetBuffer,
} from "../src/index";

type FetchFake = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;
const asFetch = (fake: FetchFake) => fake as unknown as typeof globalThis.fetch;

beforeEach(() => {
  uninstallWhyFetch();
  resetWhyCall();
  resetBuffer();
  configureWhyFetch({ output: "buffer", duplicateWindow: 0, slowRequestMs: 10_000, largePayloadKb: 10_000 });
});

afterEach(() => {
  uninstallWhyFetch();
  resetBuffer();
  configureWhyFetch({ output: "console" });
});

function withFake(fake: FetchFake) {
  globalThis.fetch = asFetch(fake);
  installWhyFetch();
}

function installFakeWithTimings(fake: FetchFake, config: Parameters<typeof configureWhyFetch>[0]) {
  const clock = { t: 0 };
  configureWhyFetch({ ...config, now: () => clock.t });
  globalThis.fetch = asFetch(fake);
  installWhyFetch();
  return clock;
}

describe("fetchscope", () => {
  it("logs one line per request", async () => {
    withFake(async () => new Response(JSON.stringify({ ok: true })));
    await globalThis.fetch("/api/products");
    expect(bufferedMessages()).toHaveLength(1);
  });

  it("reports duration with the injectable clock", async () => {
    const clock = installFakeWithTimings(
      async () => new Response("{}"),
      { slowRequestMs: 1000 },
    );
    const p = globalThis.fetch("/api/products");
    clock.t = 182;
    await p;
    const msgs = bufferedMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("182ms");
  });

  it("flags duplicates within the window", async () => {
    installFakeWithTimings(
      async () => new Response("{}"),
      { duplicateWindow: 100, slowRequestMs: 100_000 },
    );
    await globalThis.fetch("/api/products");
    // stay inside the 100ms duplicate window (clock only moves during records)
    await globalThis.fetch("/api/products");
    const msgs = bufferedMessages();
    expect(msgs.some((m) => m.includes("duplicate request"))).toBe(true);
  });

  it("slow request warning", async () => {
    const clock = installFakeWithTimings(
      async () => new Response("{}"),
      { slowRequestMs: 500, duplicateWindow: 0 },
    );
    const p = globalThis.fetch("/api/dashboard");
    clock.t += 842;
    await p;
    expect(bufferedMessages().some((m) => m.includes("slow request"))).toBe(true);
  });

  it("large payload warning from content-length", async () => {
    withFake(async () =>
      new Response("x".repeat(700_000), { headers: { "content-length": `${700_000}` } }),
    );
    configureWhyFetch({ largePayloadKb: 500, duplicateWindow: 0 });
    await globalThis.fetch("/api/products");
    expect(bufferedMessages().some((m) => m.includes("big payload"))).toBe(true);
  });

  it("respects ignore patterns", async () => {
    installFakeWithTimings(async () => new Response("{}"), { ignore: ["/analytics"], duplicateWindow: 0 });
    await globalThis.fetch("/analytics/collect");
    expect(bufferedMessages()).toHaveLength(0);
  });

  it("uninstall restores the previous fetch", async () => {
    const fake = asFetch(async () => new Response("{}"));
    globalThis.fetch = fake;
    installWhyFetch();
    uninstallWhyFetch();
    expect(globalThis.fetch).toBe(fake);
  });

  it("statsFor averages url timings", async () => {
    const clock = installFakeWithTimings(
      async () => new Response("{}"),
      { slowRequestMs: 100_000, duplicateWindow: 0 },
    );
    const p1 = globalThis.fetch("/api/products");
    clock.t += 10;
    await p1;
    const p2 = globalThis.fetch("/api/products");
    clock.t += 10;
    await p2;
    expect(statsFor("/api/products")).toEqual({ count: 2, avgMs: 10 });
  });
});
