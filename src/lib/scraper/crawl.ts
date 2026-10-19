// decides WHICH pages to read (at most 12) and fetches them.

// homepage + robots.txt + sitemap -> rank links -> fetch the best few, politely.

// npm lib that turns HTML string to searchable tree
import * as cheerio from "cheerio";
import { fetchPage, fetchText, type FetchedPage } from "./fetchPage";
import { isAllowed, loadRobots } from "./robots";
import { ABOUT_PARENT, linkGroupsUnder, readMenu, SERVICES_PARENT } from "./siteMenu";

const MAX_PAGES = 12;

// for about, team, testimonials and etc..
const MAX_SERVICE_PAGES = 5;

// how many pages fetch at once
const CONCURRENCY = 4;

const MAX_POLITE_DELAY_S = 1.5;

/** [regex, weight] pairs matched against the URL path and link text; higher = more useful. */

// scraping texts off of websites and grading them in their importance
const PAGE_KEYWORDS: [RegExp, number][] = [
  [/about|our-story|who-we-are|history|company|companyinfo/, 10],
  [/service|solution|offering|product|what-we-do|pricing|plans/, 7],
  [/team|staff|leadership|people|meet|bios?\b/, 8],
  [/contact|areas?-we-serve|service-area/, 7],
  [/faq|questions/, 7],
  [/testimonial|review|case-stud/, 7],
  [/promotion|special|offer|deal|coupon/, 4],
  [/news|press|media/, 3],
  [/blog/, 2],
  [/privacy|terms|legal/, 2],
];

const LOW_VALUE = /join|career|jobs?\b|apply|employment|login|sign-?in|cart|checkout|account|quote|request|estimate|booking|schedule|payment|thank-?you/;

const BLOG_POST = /^\/(blog|news|posts?|articles?|insights)\/[^/]+/;

const SKIP = /\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|mp3|docx?|xml)$|\/(wp-admin|wp-json|feed)\b/i;

// grading system; takes a webpage and what the link says
export function scorePage(path: string, linkText = ""): number {
  const haystack = `${path} ${linkText}`.toLowerCase();
  let score = PAGE_KEYWORDS.reduce((s, [re, weight]) => (re.test(haystack) ? s + weight : s), 0);

  // individual blog posts mention "services" a lot but aren't facts.
  if (BLOG_POST.test(path.toLowerCase())) score = Math.min(score, 1);
  return LOW_VALUE.test(path.toLowerCase()) ? score - 10 : score;
}

// resolves relative links since a lot of webpages are in messy ways, it cleans them up
export function normalizeUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    u.search = "";
    if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return null;
  }
}

// we only crawl to the company's site
export function sameSite(a: string, b: string): boolean {
  const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
  return host(a) === host(b);
}

// used to pause between requests when a site asks for a Crawl-delay.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// reads page URLs from the sitemap.
async function sitemapUrls(declared: string[], origin: string): Promise<string[]> {
  const candidates = declared.length
    ? declared
    : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];

  const readLocs = async (url: string): Promise<string[]> => {
    try {
      const { status, text } = await fetchText(url, "application/xml,text/xml");
      if (status >= 400 || !text.includes("<loc")) return [];
      const $ = cheerio.load(text, { xml: true });
      return $("loc").map((_, el) => $(el).text().trim()).get();
    } catch {
      return [];
    }
  };

  for (const sitemap of candidates.slice(0, 3)) {
    const locs = await readLocs(sitemap);
    if (!locs.length) continue;
    const pages = locs.filter((u) => !u.endsWith(".xml"));
    if (pages.length) return pages.slice(0, 300);
    // An index of sitemaps: prefer the one listing pages, not posts or products.
    const child = locs.find((u) => /page/i.test(u)) ?? locs[0];
    return (await readLocs(child)).filter((u) => !u.endsWith(".xml")).slice(0, 300);
  }
  return [];
}

// what the crawl returns basically
export interface CrawlResult {
  pages: FetchedPage[];
  skippedByRobots: string[];
  crawlDelay: number | null;
}

// fetch home -> robots -> score links -> filter -> fetch in batches
export async function crawlSite(startUrl: string, onProgress?: (message: string) => void): Promise<CrawlResult> {
  onProgress?.("Fetching homepage");
  const home = await fetchPage(startUrl);
  const origin = new URL(home.url).origin;

  onProgress?.("Reading robots.txt and sitemap");
  const robots = await loadRobots(origin);

  const candidates = new Map<string, { score: number; isService: boolean }>();

  const consider = (raw: string, linkText: string, bonus = 0, isService = false) => {
    const url = normalizeUrl(raw, home.url);
    if (!url || !sameSite(url, home.url) || SKIP.test(url)) return;
    const score = scorePage(new URL(url).pathname, linkText) + bonus;
    const prev = candidates.get(url);
    if (!prev || score > prev.score) candidates.set(url, { score, isService: isService || !!prev?.isService });
  };

  const $ = cheerio.load(home.html);
  // The main menu is the site's own map of what matters.
  for (const link of readMenu($, home.url)) {
    const underServices = !!link.parent && SERVICES_PARENT.test(link.parent);
    const underAbout = !!link.parent && ABOUT_PARENT.test(link.parent);
    consider(link.url, link.label, 3 + (underServices ? 8 : 0) + (underAbout ? 5 : 0), underServices);
  }
  for (const link of linkGroupsUnder($, home.url, SERVICES_PARENT)) {
    consider(link.url, link.label, 8, true);
  }
  $("a[href]").each((_, el) => consider($(el).attr("href") ?? "", $(el).text()));
  for (const raw of await sitemapUrls(robots.sitemaps, origin)) {
    if (!candidates.has(normalizeUrl(raw, origin) ?? "")) consider(raw, "");
  }
  candidates.delete(normalizeUrl(home.url, home.url)!);

  // ---- Rank, respecting robots.txt and keeping a mix of page types ----
  const skippedByRobots: string[] = [];
  let servicePages = 0;
  const ranked = [...candidates.entries()]
    .filter(([url]) => {
      const u = new URL(url);
      const ok = isAllowed(u.pathname + u.search, robots);
      if (!ok) skippedByRobots.push(url);
      return ok;
    })
    .filter(([, c]) => c.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .filter(([, c]) => !c.isService || ++servicePages <= MAX_SERVICE_PAGES)
    .slice(0, MAX_PAGES - 1)
    .map(([url]) => url);

  onProgress?.(`Found ${ranked.length} useful pages`);

  // With a Crawl-delay, fetch one page at a time and pause.
  const delayMs = robots.crawlDelay ? Math.min(robots.crawlDelay, MAX_POLITE_DELAY_S) * 1000 : 0;
  const concurrency = robots.crawlDelay ? 1 : CONCURRENCY;
  const pages: FetchedPage[] = [home];
  for (let i = 0; i < ranked.length; i += concurrency) {
    if (delayMs) await sleep(delayMs);
    const batch = ranked.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((u) => fetchPage(u)));
    for (const r of results) if (r.status === "fulfilled") pages.push(r.value);
    onProgress?.(`Read ${pages.length} of ${ranked.length + 1} pages`);
  }

  return { pages, skippedByRobots, crawlDelay: robots.crawlDelay };
}
