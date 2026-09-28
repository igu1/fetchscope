export interface WhyCallConfig {
  /** how long a request is "slow" (default 500ms) */
  slowRequestMs?: number;
  /** payload warning above this size (default 500KB) */
  largePayloadKb?: number;
  /** duplicate detection window (default 100ms, 0 disables) */
  duplicateWindow?: number;
  /** url patterns to leave alone */
  ignore?: Array<string | RegExp>;
  /** output: console (default), silent, buffer, custom */
  output?: "console" | "silent" | "buffer" | ((message: string) => void);
  /** inject clock for tests (ms) */
  now?: () => number;
}

export interface RequestRecord {
  url: string;
  method: string;
  durationMs: number;
  source?: string;
  payloadBytes?: number;
  startedAt: number;
  finishedAt: number;
}

export interface WhyCallStats {
  count: number;
  durations: number[];
}
