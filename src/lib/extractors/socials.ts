// Extractor 3: social media profiles.

import type { SocialLink, SocialPlatform } from "@/types/knowledge";
import type { Extractor } from "./types";
import { result } from "./types";

const PLATFORMS: [RegExp, SocialPlatform][] = [
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(twitter|x)\.com$/, "twitter"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)pinterest\.com$/, "pinterest"],
  [/(^|\.)yelp\.com$/, "yelp"],
];

const NOT_A_PROFILE = /\/(sharer|share|intent|dialog|plugins|embed|watch\?)/i;

export function classifySocialUrl(href: string): SocialLink | null {
  //   1. Must be a real absolute URL ("javascript:void(0)" or "#" throw here).
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  //   2. The host must belong to a social platform. Strip www. and m.
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const match = PLATFORMS.find(([pattern]) => pattern.test(host));
  if (!match) return null;

  //   3. It must point at a profile, not a share button or the platform's homepage.
  if (NOT_A_PROFILE.test(url.pathname + url.search)) return null;
  if (url.pathname === "/" || url.pathname === "") return null;

  url.hash = "";
  url.search = ""; // tracking params like ?osq=... or ?ref=...
  return { platform: match[1], url: url.toString() };
}

export const socialsExtractor: Extractor = {
  name: "socials",
  run(ctx) {
    const found = new Map<SocialPlatform, SocialLink>();

    // Profiles are almost always in the header or footer, which repeat on every page.
    const hrefs: string[] = [];
    ctx.home.$("a[href]").each((_, el) => {
      hrefs.push(ctx.home.$(el).attr("href") ?? "");
    });
    ctx.home.$('script[type="application/ld+json"]').each((_, el) => {
      const sameAs = ctx.home.$(el).text().match(/"sameAs"\s*:\s*\[([^\]]*)\]/);
      if (sameAs) hrefs.push(...(sameAs[1].match(/https?:[^"]+/g) ?? []));
    });

    for (const href of hrefs) {
      const link = classifySocialUrl(href);
      if (link && !found.has(link.platform)) found.set(link.platform, link);
    }

    if (found.size === 0) return result();
    return result(
      { onlinePresence: { socials: [...found.values()] } },
      { "onlinePresence.socials": { method: "html", confidence: "high", url: ctx.home.url } },
    );
  },
};
