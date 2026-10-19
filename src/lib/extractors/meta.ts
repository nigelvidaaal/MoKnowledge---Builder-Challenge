// Extractor 2: <meta> and Open Graph tags (medium confidence).

import type { Extractor } from "./types";
import { result } from "./types";

export const metaExtractor: Extractor = {
  name: "meta",
  run({ home }) {
    const { $ } = home;

    const meta = (selector: string) => $(selector).attr("content")?.trim() || null;

    const siteName = meta('meta[property="og:site_name"]');
    // Titles look like "Home | Bee Cave Drilling" or "Bee Cave Drilling - Water Wells".
    const titleParts = home.title
      .split(/\s[|\-–—:]\s/)
      .map((s) => s.trim())
      .filter((s) => s && !/^(home|welcome|homepage)$/i.test(s));
    // Shortest piece is usually the brand name.
    const fromTitle = titleParts.sort((a, b) => a.length - b.length)[0] ?? null;

    const description = meta('meta[name="description"]') ?? meta('meta[property="og:description"]');
    const ogImage = meta('meta[property="og:image"]');
    const themeColor = meta('meta[name="theme-color"]');

    const out = result();
    const src = { method: "meta" as const, confidence: "medium" as const, url: home.url };

    out.data.foundation = {};
    if (siteName ?? fromTitle) {
      out.data.foundation.name = siteName ?? fromTitle;
      out.sources["foundation.name"] = { ...src, confidence: siteName ? "medium" : "low" };
    }
    if (description) {
      out.data.foundation.overview = description;
      out.sources["foundation.overview"] = src;
    }

    out.data.branding = {};
    if (themeColor && /^#[0-9a-f]{3,8}$/i.test(themeColor)) {
      out.data.branding.colors = [themeColor.toLowerCase()];
      out.sources["branding.colors"] = src;
    }
    if (ogImage) {
      // og:image is often a hero photo, so it's only a weak logo guess.
      out.data.branding.logos = [new URL(ogImage, home.url).toString()];
      out.sources["branding.logos"] = { ...src, confidence: "low" };
    }
    return out;
  },
};
