// reads a site's navigation.

import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export interface MenuLink {
  label: string;
  url: string;
  /** Label of the top-level menu item this link sits under, if any. */
  parent: string | null;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function resolve(href: string | undefined, base: string): string | null {
  if (!href || href === "#" || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  try {
    const u = new URL(href, base);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** The <ul> with the most nested submenus is almost always the main menu. */
function findMainMenu($: CheerioAPI): AnyNode | null {
  let best: AnyNode | null = null;
  let bestScore = 0;
  $("nav ul, header ul, ul[id*=menu], ul[class*=menu]").each((_, ul) => {
    const topItems = $(ul).children("li");
    if (topItems.length < 2) return;
    const withSubmenus = topItems.filter((__, li) => $(li).find("ul").length > 0).length;
    const score = withSubmenus * 10 + topItems.length;
    if (score > bestScore) {
      bestScore = score;
      best = ul;
    }
  });
  return best;
}

/** Fallback for Framer/Webflow menus: plain <a> tags in a <nav> or <header>, no <ul>. */
function flatHeaderLinks($: CheerioAPI, baseUrl: string): MenuLink[] {
  const seen = new Set<string>();
  const links: MenuLink[] = [];
  $("header a[href], nav a[href]").each((_, a) => {
    const url = resolve($(a).attr("href"), baseUrl);
    const label = clean($(a).text());
    if (!url || !label || label.length > 40 || seen.has(url)) return;
    seen.add(url);
    links.push({ label, url, parent: null });
  });
  return links;
}

export function readMenu($: CheerioAPI, baseUrl: string): MenuLink[] {
  const menu = findMainMenu($);
  if (!menu) return flatHeaderLinks($, baseUrl);

  const links: MenuLink[] = [];
  $(menu)
    .children("li")
    .each((_, li) => {
      const top = $(li).children("a").first();
      const parentLabel = clean(top.text());
      const topUrl = resolve(top.attr("href"), baseUrl);
      if (topUrl && parentLabel) links.push({ label: parentLabel, url: topUrl, parent: null });

      $(li)
        .find("ul a")
        .each((__, a) => {
          const url = resolve($(a).attr("href"), baseUrl);
          const label = clean($(a).text());
          if (url && label) links.push({ label, url, parent: parentLabel || null });
        });
    });
  return links;
}

export const SERVICES_PARENT = /services?|solutions?|what we do|products?|offerings?|treatments?|practice areas?|our work|capabilities/i;
/** Top-level menu items that are navigation, not something the business sells. */
export const NAV_ONLY = /\b(home|about|blog|news|contact|faq|library|resources?|careers?|jobs|employment|pricing|log ?in|sign ?(in|up)|payment|pay|schedule|book|consultation|quote|estimate|reviews?|testimonials?|gallery|portfolio|case studies|locations?|areas?|shop|cart|events?|specials?|coupons?|team|support|help|changelog|demo)\b/i;
/** Button text that names nothing ('Learn more', 'View all'). */
const GENERIC_LINK = /^(learn more|read more|view all|see all|more|details|click here|explore)\b/i;
/** Menu labels for the company's own pages (About, Company, Our Story). */
export const ABOUT_PARENT = /about|company|who we are|our story/i;

/** Footer-style columns: a short heading ("Products") with links under it. */
export function linkGroupsUnder($: CheerioAPI, baseUrl: string, heading: RegExp): MenuLink[] {
  const links: MenuLink[] = [];
  const seen = new Set<string>();
  $("body *").each((_, el) => {
    const node = $(el);
    if (node.children().length > 1 || node.is("a") || node.closest("a").length) return;
    const label = clean(node.text());
    if (!label || label.length > 30 || !new RegExp(`^(${heading.source})$`, "i").test(label)) return;

    // Climb to the smallest ancestor that holds a handful of links.
    let group = node.parent();
    for (let i = 0; i < 4 && group.find("a[href]").length < 2; i++) group = group.parent();
    const anchors = group.find("a[href]");
    if (anchors.length < 2 || anchors.length > 20) return;

    anchors.each((__, a) => {
      const url = resolve($(a).attr("href"), baseUrl);
      const text = clean($(a).text());
      // "Learn more" buttons say nothing; the same URL usually appears again with a real name.
      if (url && text && text.length <= 60 && !seen.has(url) && !GENERIC_LINK.test(text) && !NAV_ONLY.test(text)) {
        seen.add(url);
        links.push({ label: text, url, parent: label });
      }
    });
  });
  return links;
}
