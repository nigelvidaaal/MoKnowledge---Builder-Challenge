//  Pulling facts out (extractors)
// What this file is: the Extractor interface every extractor implements, plus a small helper.
// Why it matters: read this before the other extractor files. Every extractor has the same
// shape, so scrapeSite.ts can run them all in one loop.
// ===================================================================

import type { ExtractorResult } from "@/types/knowledge";
import type { ExtractContext } from "@/lib/scraper/page";

/**
 * Extractor: an object with a name and a run(ctx) function that returns an ExtractorResult.
 * Why: Like an abstract base class in C++ with one virtual method. Adding a new kind of data
 *      means adding one object that matches this interface.
 */

/**
 * An extractor looks at the parsed pages and returns whatever it found.
 * Each one is a pure function: same pages in, same result out.
 * That makes them easy to test with saved HTML.
 */
export interface Extractor {
  name: string;
  run: (ctx: ExtractContext) => ExtractorResult;
}

// builds an ExtractorResult with empty defaults.
export function result(
  data: ExtractorResult["data"] = {},
  sources: ExtractorResult["sources"] = {},
): ExtractorResult {
  return { data, sources };
}