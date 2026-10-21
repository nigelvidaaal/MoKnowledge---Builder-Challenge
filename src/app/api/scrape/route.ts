// POST /api/scrape { url }: streams NDJSON progress events, then the result or an error.

import { FetchError } from "@/lib/scraper/fetchPage";
import { scrapeSite } from "@/lib/scraper/scrapeSite";
import { validateUrl } from "@/lib/scraper/validateUrl";

export const runtime = "nodejs"; // cheerio needs Node, not the Edge runtime
/** Up to 60s per request on hosts like Vercel. */
export const maxDuration = 60;

// setting the event types 
export type ScrapeEvent =
  | { type: "progress"; message: string }
  | { type: "result"; knowledge: unknown; warnings: string[] }
  | { type: "error"; error: string };

export async function POST(request: Request) {
  // parses incoming HTML as JSON 
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const check = validateUrl(typeof body.url === "string" ? body.url : "");
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  // streaming response 
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ScrapeEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const { knowledge, warnings } = await scrapeSite(check.url, (message) => send({ type: "progress", message }));
        send({ type: "result", knowledge, warnings });
      } catch (err) {
        const message =
          err instanceof FetchError
            ? `${err.message} (${err.url})`
            : "Something went wrong while scraping. Please try again.";
        if (!(err instanceof FetchError)) console.error("[scrape]", err);
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
