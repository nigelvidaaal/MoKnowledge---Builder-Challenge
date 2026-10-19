// reads a site's robots.txt and answers 'is our bot allowed to fetch this path?'

import { fetchText } from "./fetchPage";

export interface RobotsRules {
  disallow: string[];
  allow: string[];
  sitemaps: string[];
  /** Seconds between requests the site asks for, if any. */
  crawlDelay: number | null;
}

/** Keeps only the 'User-agent: *' rules; no robots.txt means no restrictions. */
export async function loadRobots(origin: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallow: [], allow: [], sitemaps: [], crawlDelay: null };
  try {
    const { status, text } = await fetchText(`${origin}/robots.txt`, "text/plain");
    if (status >= 400) return rules;

    let appliesToUs = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.split("#")[0].trim();
      const sep = line.indexOf(":");
      if (sep === -1) continue;
      const key = line.slice(0, sep).trim().toLowerCase();
      const value = line.slice(sep + 1).trim();

      if (key === "user-agent") appliesToUs = value === "*";
      else if (key === "sitemap") rules.sitemaps.push(value);
      else if (!appliesToUs) continue;
      else if (key === "disallow" && value) rules.disallow.push(value);
      else if (key === "allow" && value) rules.allow.push(value);
      else if (key === "crawl-delay" && Number(value) > 0) rules.crawlDelay = Number(value);
    }
  } catch {
  }
  return rules;
}

/** Turns a robots.txt path pattern into a regex anchored at the start. */
function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; on a tie, Allow wins (Google's rule). */
export function isAllowed(pathAndQuery: string, rules: RobotsRules): boolean {
  const longest = (list: string[]) =>
    list.filter((p) => patternToRegex(p).test(pathAndQuery)).reduce((max, p) => Math.max(max, p.length), -1);
  return longest(rules.allow) >= longest(rules.disallow);
}
