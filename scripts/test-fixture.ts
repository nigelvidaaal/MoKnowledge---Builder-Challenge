// Runs every extractor against saved HTML, no network needed.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { EXTRACTORS } from "@/lib/extractors";
import { emptyKnowledgeBase } from "@/lib/knowledge/empty";
import { mergeResult } from "@/lib/knowledge/merge";
import { deriveAll } from "@/lib/knowledge/derive";
import { buildContext, parsePage } from "@/lib/scraper/page";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--")) ?? "desert-peak";
const full = args.includes("--full");
const dir = join(process.cwd(), "fixtures", name);
const origin = `https://${name}.example`;

function htmlFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return entry.endsWith(".html") ? [path] : [];
  });
}

const files = htmlFiles(dir).sort((a, b) => (a.endsWith("/index.html") ? -1 : b.endsWith("/index.html") ? 1 : a.localeCompare(b)));

const pages = files.map((file) => {
  const rel = relative(dir, file).replace(/\\/g, "/").replace(/\.html$/, "");
  return parsePage({
    url: rel === "index" ? `${origin}/` : `${origin}/${rel}`,
    status: 200,
    html: readFileSync(file, "utf8"),
  });
});

const ctx = buildContext(pages);
const kb = emptyKnowledgeBase(`${origin}/`);
kb.scrapedPages = pages.map((p) => p.url);
kb.sources["foundation.website"] = { method: "html", confidence: "high", url: `${origin}/` };

for (const extractor of EXTRACTORS) {
  const res = extractor.run(ctx);
  const found = Object.keys(res.sources);
  console.log(`[${extractor.name}] ${found.length ? found.join(", ") : "(nothing found)"}`);
  mergeResult(kb, res);
}

// Same post-merge step as a real scrape: people's photos and content starters.
deriveAll(kb);
console.log(`[derive] ${kb.extras.contentStarters.length} content starters`);

const { sources, ...rest } = kb;
console.log("\n" + JSON.stringify(full ? kb : rest, null, 2));
if (!full) console.log(`\n(${Object.keys(sources).length} fields have sources; add --full to see them)`);
