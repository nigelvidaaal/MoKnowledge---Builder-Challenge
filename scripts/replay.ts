// Replays a captured website through the REAL pipeline.

import { readFileSync, writeFileSync } from "node:fs";
import { scrapeSite } from "@/lib/scraper/scrapeSite";

interface Capture {
  origin: string;
  files: Record<string, { status: number; text: string }>;
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const saveIdx = args.indexOf("--save");
const savePath = saveIdx >= 0 ? args[saveIdx + 1] : null;
if (!file) {
  console.error("Usage: npm run replay -- <capture.json> [--save <out.json>]");
  process.exit(1);
}

const capture = JSON.parse(readFileSync(file, "utf8")) as Capture;
const served: string[] = [];
const missing: string[] = [];

function lookup(url: URL) {
  const path = url.pathname + url.search;
  const variants = [path, path.endsWith("/") ? path.slice(0, -1) : `${path}/`, url.pathname, `${url.pathname}/`];
  for (const v of variants) if (capture.files[v]) return capture.files[v];
  return null;
}

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const hit = url.hostname.replace(/^www\./, "") === new URL(capture.origin).hostname.replace(/^www\./, "") ? lookup(url) : null;
  if (!hit) {
    missing.push(url.pathname);
    return new Response("Not captured", { status: 404, headers: { "content-type": "text/plain" } });
  }
  served.push(url.pathname);
  const type = /\.css(\?|$)/.test(url.pathname + url.search)
    ? "text/css"
    : /\.xml$/.test(url.pathname)
      ? "application/xml"
      : url.pathname === "/robots.txt"
        ? "text/plain"
        : "text/html; charset=utf-8";
  const res = new Response(hit.text, { status: hit.status, headers: { "content-type": type } });
  Object.defineProperty(res, "url", { value: url.toString() });
  return res;
}) as typeof fetch;

async function main() {
  const started = Date.now();
  const { knowledge, warnings } = await scrapeSite(`${capture.origin}/`, (m) => console.log(`  … ${m}`));

  const filled = Object.keys(knowledge.sources);
  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s. Pages read: ${knowledge.scrapedPages.length}`);
  knowledge.scrapedPages.forEach((p) => console.log(`  - ${p}`));
  if (missing.length) console.log(`Not in capture (404 in replay): ${[...new Set(missing)].join(", ")}`);
  if (warnings.length) console.log(`Warnings:\n  ${warnings.join("\n  ")}`);
  console.log(`\n${filled.length} fields filled:\n  ${filled.join(", ")}`);

  const { sources: _sources, ...rest } = knowledge;
  void _sources;
  console.log("\n" + JSON.stringify(rest, null, 2));

  if (savePath) {
    writeFileSync(savePath, JSON.stringify(knowledge, null, 2));
    console.log(`\nSaved to ${savePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
