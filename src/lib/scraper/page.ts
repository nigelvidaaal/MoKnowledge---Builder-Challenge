// parses each page once and shares it, so every extractor gets the same view of the site.

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { FetchedPage } from "./fetchPage";

/** One fetched page, parsed once and shared by every extractor. */
export interface ParsedPage {
  url: string;
  $: CheerioAPI;
  title: string;
  text: string;
}

const BLOCK_TAGS =
  "p, div, li, h1, h2, h3, h4, h5, h6, dt, dd, td, th, tr, section, article, header, footer, nav, aside, blockquote, summary, details, figcaption, address, form, label, button, a, br, hr";

export function parsePage(page: FetchedPage): ParsedPage {
  const $ = cheerio.load(page.html);

  // Text comes from a copy, so extractors still see <script> (JSON-LD) and <style> (colors).
  const textDoc = cheerio.load(page.html);
  textDoc("script, style, noscript, svg, iframe, template").remove();
  textDoc(BLOCK_TAGS).after("\n");
  const text = textDoc("body")
    .text()
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  return { url: page.url, $, title: $("title").first().text().trim(), text };
}

/** Everything an extractor can look at. `home` is always pages[0]. */
export interface ExtractContext {
  home: ParsedPage;
  pages: ParsedPage[];
  /** Text of the site's own CSS files (not fonts/CDN CSS), for colors and fonts. */
  stylesheets: string[];
  /** Pages whose URL matches a pattern, e.g. pagesMatching(/about/). */
  pagesMatching: (pattern: RegExp) => ParsedPage[];
}

export function buildContext(pages: ParsedPage[], stylesheets: string[] = []): ExtractContext {
  return {
    home: pages[0],
    pages,
    stylesheets,
    pagesMatching: (pattern) => pages.filter((p) => pattern.test(new URL(p.url).pathname)),
  };
}

/** Same-site stylesheet URLs linked from a page (skips Google Fonts and CDNs). */
export function stylesheetUrls(page: ParsedPage, limit = 4): string[] {
  const host = new URL(page.url).hostname.replace(/^www\./, "");
  const urls: string[] = [];
  page.$('link[rel="stylesheet"][href]').each((_, el) => {
    try {
      const u = new URL(page.$(el).attr("href")!, page.url);
      if (u.hostname.replace(/^www\./, "") === host) urls.push(u.toString());
    } catch {
      // ignore malformed hrefs
    }
  });
  return urls.slice(0, limit);
}
