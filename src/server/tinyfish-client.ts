import type { BrowserMode, TinyFishEvent } from "../shared/contracts.js";

export type TinyFishRunRequest = {
  url: string;
  goal: string;
  browserProfile: Extract<BrowserMode, "lite" | "stealth">;
};

export type TinyFishRawEvent = {
  type?: string;
  run_id?: string;
  timestamp?: string;
  streaming_url?: string;
  purpose?: string;
  status?: string;
  result?: unknown;
  resultJson?: unknown;
  error?: unknown;
};

export function tinyFishConfigured(): boolean {
  return Boolean(process.env.TINYFISH_API_KEY);
}

export function tinyFishApiBase(): string {
  return process.env.TINYFISH_API_BASE ?? "https://agent.tinyfish.ai";
}

export function normalizeTinyFishEvent(raw: TinyFishRawEvent): TinyFishEvent {
  const kind = (raw.type ?? "").toUpperCase();
  const detail =
    kind === "STREAMING_URL"
      ? "Live browser session available."
      : kind === "PROGRESS"
        ? raw.purpose ?? "TinyFish reported a navigation update."
        : kind === "COMPLETE"
          ? `Run finished with status ${raw.status ?? "COMPLETED"}.`
          : kind === "ERROR"
            ? String(raw.error ?? "TinyFish reported an error.")
            : "TinyFish accepted the run.";

  return {
    id: `${raw.run_id ?? "tf"}-${raw.timestamp ?? Date.now()}-${kind.toLowerCase()}`,
    type:
      kind === "STREAMING_URL"
        ? "streaming_url"
        : kind === "PROGRESS"
          ? "progress"
          : kind === "COMPLETE"
            ? "complete"
            : kind === "ERROR"
              ? "error"
              : "started",
    title:
      kind === "STREAMING_URL"
        ? "Browser stream ready"
        : kind === "PROGRESS"
          ? "TinyFish progress"
          : kind === "COMPLETE"
            ? "TinyFish complete"
            : kind === "ERROR"
              ? "TinyFish error"
              : "TinyFish started",
    detail,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    run_id: raw.run_id ?? null,
    streaming_url: raw.streaming_url ?? null,
  };
}

export async function streamTinyFishRun(
  request: TinyFishRunRequest,
  onEvent: (event: TinyFishRawEvent) => void,
): Promise<{ live: boolean; runId: string | null; result: unknown }> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY is not configured.");
  }

  const response = await fetch(`${tinyFishApiBase()}/v1/automation/run-sse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      url: request.url,
      goal: request.goal,
      browser_profile: request.browserProfile,
      api_integration: "codex-scene-orchestrator",
      use_vault: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TinyFish request failed (${response.status}): ${text}`);
  }

  const body = response.body;
  if (!body) {
    throw new Error("TinyFish did not return a readable SSE stream.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let runId: string | null = null;
  let finalResult: unknown = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const payload = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");

      if (!payload || payload === "[DONE]") {
        continue;
      }

      let parsed: TinyFishRawEvent;
      try {
        parsed = JSON.parse(payload) as TinyFishRawEvent;
      } catch {
        continue;
      }

      if (parsed.run_id) {
        runId = parsed.run_id;
      }
      if (parsed.type?.toUpperCase() === "COMPLETE") {
        finalResult = parsed.result ?? parsed.resultJson ?? null;
      }
      onEvent(parsed);
    }

    if (done) {
      break;
    }
  }

  return { live: true, runId, result: finalResult };
}
