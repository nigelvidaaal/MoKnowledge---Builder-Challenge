// Calls /api/scrape and reads the streamed progress events.

import type { KnowledgeBase } from "@/types/knowledge";
import type { ScrapeEvent } from "@/app/api/scrape/route";

/** Reads the streamed response line by line (one JSON event per line). */
export async function runScrape(
  url: string,
  onProgress: (message: string) => void,
): Promise<{ knowledge: KnowledgeBase; warnings: string[] }> {
  const res = await fetch("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Each complete line is one event; keep any partial line for next time.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ScrapeEvent;
      if (event.type === "progress") onProgress(event.message);
      if (event.type === "error") throw new Error(event.error);
      if (event.type === "result") {
        return { knowledge: event.knowledge as KnowledgeBase, warnings: event.warnings };
      }
    }
  }
  throw new Error("The scrape ended without a result.");
}
