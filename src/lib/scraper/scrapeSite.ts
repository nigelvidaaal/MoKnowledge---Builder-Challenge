// the whole pipeline: crawl -> parse -> extract -> merge -> knowledge base + warnings.

import type { KnowledgeBase } from "@/types/knowledge";
import { EXTRACTORS } from "@/lib/extractors";
import { emptyKnowledgeBase } from "@/lib/knowledge/empty";
import { mergeResult } from "@/lib/knowledge/merge";
import { deriveAll } from "@/lib/knowledge/derive";
import { crawlSite } from "./crawl";
import { fetchText } from "./fetchPage";
import { buildContext, parsePage, stylesheetUrls } from "./page";

export interface ScrapeOutcome {
  knowledge: KnowledgeBase;
  /** Non-fatal problems the reviewer should know about. */
  warnings: string[];
}

export async function scrapeSite(
  url: string,
  onProgress?: (message: string) => void,
  // "this function eventually gives you a ScrapeOutcome"
): Promise<ScrapeOutcome> {
  const warnings: string[] = [];
  // run the crawler and await for it
  const { pages, skippedByRobots, crawlDelay } = await crawlSite(url, onProgress);

  // running several warning messages just to inform user, non critical
  if (crawlDelay) {
    warnings.push(
      `This site asks bots to wait ${crawlDelay}s between requests. We read pages one at a time with a short pause instead, to keep the scrape under a minute.`,
    );
  }

  if (skippedByRobots.length) {
    warnings.push(`Skipped ${skippedByRobots.length} page(s) the site asks bots not to read (robots.txt).`);
  }

  // turns raw HTML page into a parsed page
  const parsed = pages.map(parsePage);

  onProgress?.("Reading stylesheets for brand colors and fonts");

  // fetch css files, allSettled waits until every download has either; succeeded or failed
  const cssResults = await Promise.allSettled(
    stylesheetUrls(parsed[0]).map((u) => fetchText(u, "text/css")),
  );

  // keep only successful ones
  const stylesheets = cssResults
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchText>>> => r.status === "fulfilled")
    .filter((r) => r.value.status < 400)
    .map((r) => r.value.text.slice(0, 500_000));

  onProgress?.("Extracting business information");
  const ctx = buildContext(parsed, stylesheets);

  // Wix/Framer/React sites may send almost no text until JavaScript runs.
  if (ctx.home.text.length < 300) {
    warnings.push(
      "The homepage has very little readable text. The site may load its content with JavaScript, so some information could be missing.",
    );
  }

  const knowledge = emptyKnowledgeBase(pages[0].url);
  knowledge.scrapedPages = parsed.map((p) => p.url);
  knowledge.sources["foundation.website"] = { method: "html", confidence: "high", url: pages[0].url };

  // run every extractor in order and merge its result into the knowledge base.
  for (const extractor of EXTRACTORS) {
    try {
      mergeResult(knowledge, extractor.run(ctx));
    } catch (err) {
      // One broken extractor shouldn't sink the whole scrape.
      warnings.push(`The ${extractor.name} step failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // connect facts across extractors (team photos -> people) and build content starters
  deriveAll(knowledge);

  return { knowledge, warnings };
}
