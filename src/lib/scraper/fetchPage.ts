// the only place that makes HTTP requests for the scraper.

// guardrails: a timeout, a size cap, a real User-Agent, and HTML-only responses.

// how our bot identifies itself to agent
export const USER_AGENT =
  "Mozilla/5.0 (compatible; MoKnowledgeBot/1.0; +https://moflo.ai)";

const TIMEOUT_MS = 12_000;

// 3 MB max
const MAX_BYTES = 3_000_000;

// final fully fetched page that we got from url, raw input goes to page.ts
export interface FetchedPage {
  url: string;
  status: number;
  html: string;
}

// fetching error when fetching pages
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

// GET that returns text of any type.
export async function fetchText(url: string, accept = "text/html"): Promise<{ url: string; status: number; text: string; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "";
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      throw new FetchError("Page is too large to scrape", url, res.status);
    }

    const text = await res.text();
    return { url: res.url || url, status: res.status, text: text.slice(0, MAX_BYTES), contentType };
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchError(`Timed out after ${TIMEOUT_MS / 1000}s`, url);
    }
    throw new FetchError("Could not reach the site", url);
  } finally {
    clearTimeout(timer);
  }
}

// fetchText plus HTML-only checks: throws on a 4xx/5xx status or a non-HTML content type.
export async function fetchPage(url: string): Promise<FetchedPage> {
  const { url: finalUrl, status, text, contentType } = await fetchText(url);

  if (status >= 400) {
    throw new FetchError(`Site responded with ${status}`, url, status);
  }
  if (contentType && !contentType.includes("html")) {
    throw new FetchError(`Not an HTML page (${contentType})`, url, status);
  }
  return { url: finalUrl, status, html: text };
}
