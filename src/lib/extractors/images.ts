// Extractor 9: the business's real photos (team, projects, services).

import type { BrandImage } from "@/types/knowledge";
import type { Extractor } from "./types";
import { result } from "./types";
import { clean, looksLikePersonName } from "./text";

/** Images whose file name or alt text says they're not photos of the business. */
const NOT_A_PHOTO =
  /logo|icon|favicon|sprite|badge|star|arrow|chevron|avatar|profile picture|placeholder|spinner|loader|pixel|emoji|rating|reviews?-|trustindex|gravatar|googleusercontent|seal|certified-|payment|visa|mastercard|qr-?code|map-marker/i;

/** Stock photo libraries: kept, but labeled so nobody posts them as "our work". */
const STOCK = /adobestock|shutterstock|istock|gettyimages|unsplash|pexels|depositphotos|dreamstime|123rf|bigstock/i;

/** Pages whose images are forms or job ads, not the business. */
const SKIP_PAGES = /join|career|jobs?\b|apply|employment|application|login|cart|checkout/i;

const MIN_WIDTH = 240; // smaller than this is a thumbnail, icon or badge
const MAX_IMAGES = 40; // the derive step trims this after attaching people's photos

/** The real image URL of an <img>. Lazy-loading sites put it in data-src or srcset. */
function bestSrc(attr: (name: string) => string | undefined): string | null {
  const srcset = attr("srcset") ?? attr("data-srcset");
  if (srcset) {
    const widest = srcset
      .split(",")
      .map((part) => part.trim().split(/\s+/))
      .map(([url, size]) => ({ url, w: parseInt(size ?? "0", 10) || 0 }))
      .sort((a, b) => b.w - a.w)[0];
    if (widest?.url) return widest.url;
  }
  return attr("data-src") ?? attr("data-lazy-src") ?? attr("src") ?? null;
}

function knownWidth(url: URL, attrWidth: string | undefined): number | null {
  const fromAttr = parseInt(attrWidth ?? "", 10);
  if (fromAttr) return fromAttr;
  const fromQuery = parseInt(url.searchParams.get("width") ?? url.searchParams.get("w") ?? "", 10);
  return fromQuery || null;
}

/** WordPress serves the same photo in many sizes (photo-300x200.jpg, photo-1024x683.jpg). */
function dedupeKey(url: URL): string {
  return `${url.hostname}${url.pathname.replace(/-\d+x\d+(?=\.\w+$)/, "")}`.toLowerCase();
}

/** Guess what a photo shows from its alt text, file name and the page it's on. */
function categorize(pageUrl: string, src: string, alt: string, inArticleList: boolean): string {
  const path = new URL(pageUrl).pathname.toLowerCase();
  const text = `${src} ${alt}`.toLowerCase();
  if (STOCK.test(src)) return "Stock";
  if (looksLikePersonName(alt) || /team|staff|crew|portrait|potrait|employee|company-photo|group photo/.test(text)) return "Team";
  if (/gallery|project|portfolio|our-work|before|after|case-stud|job-?site/.test(`${path} ${text}`)) return "Project";
  if (inArticleList || /featured-image|blog|post/.test(`${path} ${text}`)) return "Blog";
  if (path !== "/" && path !== "") return "Service";
  return "Site";
}

export const imagesExtractor: Extractor = {
  name: "images",
  run(ctx) {
    const found = new Map<string, BrandImage>(); // dedupeKey -> image
    const pagesSeenOn = new Map<string, number>(); // dedupeKey -> number of pages it appears on

    for (const page of ctx.pages) {
      if (SKIP_PAGES.test(new URL(page.url).pathname)) continue;
      const $ = page.$;
      const onThisPage = new Set<string>();

      $("img").each((_, el) => {
        const img = $(el);
        // Header, menu and footer images are logos, badges and social icons.
        if (img.closest("header, nav, footer").length) return;
        if (img.closest('a[href*="integration"], a[href*="partner"], a[href*="client"]').length) return;

        const raw = bestSrc((name) => img.attr(name));
        if (!raw || raw.startsWith("data:")) return;

        let url: URL;
        try {
          url = new URL(raw, page.url); // also resolves protocol-relative "//cdn..." links
        } catch {
          return;
        }
        if (!/^https?:$/.test(url.protocol) || /\.(svg|gif)$/i.test(url.pathname)) return;

        const alt = clean(img.attr("alt"));
        if (NOT_A_PHOTO.test(`${url.pathname} ${alt}`)) return;

        const width = knownWidth(url, img.attr("width"));
        // Unknown width is allowed (many sites omit it); a known small width is not.
        if (width !== null && width < (looksLikePersonName(alt) ? 150 : MIN_WIDTH)) return;

        const key = dedupeKey(url);
        onThisPage.add(key);
        if (!found.has(key)) {
          // Not <article>: WordPress themes wrap whole pages in it.
          const inArticleList = img.closest("[class*=blog]").length > 0;
          found.set(key, { url: url.toString(), alt: alt || null, category: categorize(page.url, url.pathname, alt, inArticleList), page: page.url });
        }
      });

      for (const key of onThisPage) pagesSeenOn.set(key, (pagesSeenOn.get(key) ?? 0) + 1);
    }

    // An image on most pages is a site-wide banner or decoration, not content.
    const sitewide = Math.max(3, Math.ceil(ctx.pages.length / 2));
    const ORDER = ["Team", "Project", "Service", "Site", "Blog", "Stock"];
    const images = [...found.entries()]
      .filter(([key]) => (pagesSeenOn.get(key) ?? 0) < sitewide)
      .map(([, image]) => image)
      .sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category))
      .slice(0, MAX_IMAGES);

    if (!images.length) return result();
    return result({ branding: { images } }, { "branding.images": { method: "html", confidence: "medium", url: ctx.home.url } });
  },
};
