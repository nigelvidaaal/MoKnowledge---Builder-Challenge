// Extractor 6: what the page *structure* reveals.

import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { Offering, Person } from "@/types/knowledge";
import type { ParsedPage } from "@/lib/scraper/page";
import type { Extractor } from "./types";
import { result } from "./types";
import { linkGroupsUnder, NAV_ONLY, readMenu, SERVICES_PARENT } from "@/lib/scraper/siteMenu";
import { blockText, clean, looksLikePersonName, mainContent, rankByFrequency, wordCount } from "./text";

const OFFERING_PATH = /\/(services?|products?|solutions?|offerings?|what-we-do|practice-areas?|treatments?|plans?)\/[^/]+/i;
const ACTION_VERB =
  /^(get|call|schedule|book|request|contact|start|try|apply|subscribe|join|shop|buy|order|claim|download|reserve|talk|speak|chat|find|search|sell|see|view|explore|learn more|sign up|free)\b/i;
const PRICE = /(\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*(?:\/|per)\s*(?:mo|month|year|yr|hour|hr|visit|project|service call|job|room|sq\.?\s?ft))?|free (?:estimate|quote|inspection|consultation|trial)|per (?:project|service call|inspection|hour|visit)|starting at \$?\d[\d,]*)/i;
const ROLE =
  /\b(owner|founder|co-founder|ceo|president|vice president|vp|cfo|coo|cto|director|manager|partner|principal|lead|head|broker|agent|realtor|cpa|attorney|technician|specialist|coordinator|assistant|consultant|advisor|engineer|designer|estimator|supervisor|administrator)\b/i;
const CHAT_WIDGETS = /intercom|drift\.com|tawk\.to|livechat|crisp\.chat|zendesk|hubspot.*conversations|tidio/i;
const SCHEDULERS = /calendly\.com|acuityscheduling|squareup\.com\/appointments|setmore|housecallpro|servicetitan|jobber|booksy|vagaro/i;

function isGenericHeading(h: string): boolean {
  return (
    /^(home|menu|contact( us)?|about( us)?|services|our services|faq|blog|news|testimonials|reviews|follow us|quick links|resources|navigation|get in touch|search|categories|recent posts|archives|privacy policy|terms)$/i.test(h) ||
    /newsletter|contact form|jump to|reviews from|how it works|subscribe|follow us|get in touch|fill out|sign up|call (us|now)|since (19|20)\d\d/i.test(h)
  );
}

function sameHost(a: string, b: string): boolean {
  const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
  return host(a) === host(b);
}

/** '/services/drain-cleaning' -> 'Drain Cleaning'. */
function titleFromPath(path: string): string {
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One service page: h1 name, first good paragraph, bullet features, price. */
function offeringFromPage(page: ParsedPage, fallbackName: string, boilerplate: Set<string> = new Set()): Offering {
  const $ = page.$;
  const main = mainContent($);
  const name = clean(main.find("h1").first().text()) || fallbackName;
  const description =
    main
      .find("p")
      .map((_, el) => clean($(el).text()))
      .get()
      .find((p) => wordCount(p) >= 12 && wordCount(p) <= 80) ?? null;
  const features = main
    .find("li")
    // Skip form fields, menus and carousel cards; keep simple bullets.
    .filter((_, el) => $(el).closest("form, nav, footer").length === 0 && $(el).find("a").length === 0 && $(el).find("div, p, h3, h4").length <= 2)
    .map((_, el) => clean($(el).text()))
    .get()
    .filter((li, i, all) => li.length > 3 && li.length < 140 && all.indexOf(li) === i && !boilerplate.has(li) && !/\*|required|^(name|email|phone|address)\b/i.test(li))
    .slice(0, 6);
  const pricing = page.text.match(PRICE)?.[0] ?? null;
  return { name, category: null, description, features, pricing, url: page.url };
}

function collectCtas($: CheerioAPI): string[] {
  const ctas: string[] = [];
  $('a, button, input[type="submit"]').each((_, el) => {
    const node = $(el);
    const label = clean(node.is("input") ? node.attr("value") : node.text());
    if (!label || label.length < 3 || label.length > 45 || wordCount(label) > 7) return;
    const looksLikeButton = /btn|button|cta/i.test(`${node.attr("class")} ${node.attr("role")}`) || node.is("button, input");
    const isPhoneCta = /^tel:/.test(node.attr("href") ?? "") && /call|\d{3}/i.test(label);
    if ((looksLikeButton && ACTION_VERB.test(label)) || isPhoneCta || (ACTION_VERB.test(label) && /free|now|today|my /i.test(label))) {
      ctas.push(label);
    }
  });
  return ctas;
}

/** Labels a form (appointment, quote, contact, newsletter...) from its fields and text. */
function classifyForm($: CheerioAPI, form: AnyNode): string | null {
  const f = $(form);
  const fields = f
    .find("input, textarea, select")
    .map((_, el) => `${$(el).attr("name")} ${$(el).attr("type")} ${$(el).attr("placeholder")} ${$(el).attr("id")}`)
    .get()
    .join(" ")
    .toLowerCase();
  const context = `${fields} ${f.attr("action")} ${f.attr("class")} ${clean(f.text())}`.toLowerCase();
  // A small search box isn't a lead funnel.
  if (/search/.test(context) && f.find("input").length <= 2) return null;
  // Most specific check first; the first match wins.
  if (/date|time|appointment|schedule|booking/.test(context)) return "Appointment scheduling form";
  if (/quote|estimate|budget|project|service type|address|zip/.test(context)) return "Quote / estimate request form";
  if (/application|apply|resume|career/.test(context)) return "Application form";
  if (f.find("textarea").length || /message|comment|question/.test(context)) return "Contact form";
  if (/email/.test(context) && f.find("input:not([type=hidden]):not([type=submit])").length <= 2) return "Newsletter signup";
  return "Lead capture form";
}

/** Team cards: <h3>Name</h3> <p>Role</p> <p>Bio</p>. */
function collectPeople(page: ParsedPage): Person[] {
  const $ = page.$;
  const people: Person[] = [];
  $("h2, h3, h4, h5, strong, b, [class*=name]").each((_, el) => {
    const name = clean($(el).text());
    if (!looksLikePersonName(name)) return;

    const card = $(el).parent();
    const lines = blockText($, card)
      .split("\n")
      .map(clean)
      .filter((l) => l && l !== name);
    const title = lines.find((l) => l.length <= 60 && ROLE.test(l));
    if (!title) return;
    const bio = lines.find((l) => l !== title && wordCount(l) >= 8);

    people.push({ name, title, gender: null, description: bio ? bio.slice(0, 400) : null });
  });
  return people;
}

export const structureExtractor: Extractor = {
  name: "structure",
  run(ctx) {
    const out = result();
    const html = (confidence: "high" | "medium" | "low", url = ctx.home.url) => ({ method: "html" as const, confidence, url });

    // ---- Offerings: Services menu, then top-level items, then /services/* URLs ----
    const offeringLinks = new Map<string, string>(); // url -> label
    const key = (u: string) => u.replace(/\/$/, "");
    const NOT_AN_OFFERING = /^(tips|how|why|what|guide|faq|blog|resources?|learn|view all|all services|see all)\b/i;

    const menu = readMenu(ctx.home.$, ctx.home.url);
    // Also footer columns headed Services/Products (Framer sites like moflo.ai).
    const grouped = linkGroupsUnder(ctx.home.$, ctx.home.url, SERVICES_PARENT);
    for (const link of [...menu, ...grouped]) {
      // "Request a Quote" sits under Services on many sites, but it's a form, not a service.
      const formLink = /quote|request|estimate|apply|contact|schedule|book/i;
      if (
        link.parent &&
        SERVICES_PARENT.test(link.parent) &&
        !formLink.test(link.parent) &&
        !formLink.test(link.label) &&
        !NOT_AN_OFFERING.test(link.label) &&
        link.label.length <= 60
      ) {
        if (sameHost(link.url, ctx.home.url)) offeringLinks.set(key(link.url), link.label);
      }
    }
    // Some menus list services at the top level (Planet Orange).
    const hasDropdowns = menu.some((l) => l.parent);
    if (offeringLinks.size === 0 && hasDropdowns) {
      for (const link of menu) {
        if (!link.parent && !NAV_ONLY.test(link.label) && link.label.length <= 60 && sameHost(link.url, ctx.home.url) && key(link.url) !== key(ctx.home.url)) {
          offeringLinks.set(key(link.url), link.label);
        }
      }
    }
    const fromMenu = offeringLinks.size > 0;

    if (!fromMenu) {
      for (const page of ctx.pages) {
        page.$("a[href]").each((_, el) => {
          try {
            const u = new URL(page.$(el).attr("href")!, page.url);
            u.hash = "";
            u.search = "";
            const label = clean(page.$(el).text());
            if (OFFERING_PATH.test(u.pathname) && sameHost(u.toString(), page.url) && label.length < 60) {
              const k = key(u.toString());
              if (!offeringLinks.has(k) || (label && !offeringLinks.get(k))) offeringLinks.set(k, label);
            }
          } catch {
            /** ignore bad href */
          }
        });
      }
    }

    const pagesByUrl = new Map(ctx.pages.map((p) => [key(p.url), p]));

    // List items on most pages (financing banners, sidebars) are boilerplate, not features.
    const liCounts = new Map<string, number>();
    for (const p of ctx.pages) {
      for (const li of new Set(p.$("li").map((_, el) => clean(p.$(el).text())).get())) liCounts.set(li, (liCounts.get(li) ?? 0) + 1);
    }
    const boilerplate = new Set([...liCounts].filter(([, n]) => n >= Math.max(3, ctx.pages.length / 2)).map(([li]) => li));
    const offerings: Offering[] = [...offeringLinks.entries()].slice(0, 20).map(([url, label]) => {
      const name = label || titleFromPath(new URL(url).pathname);
      const page = pagesByUrl.get(url);
      // Keep the menu's short name ("Pumping Systems") rather than a long page headline.
      if (page) return { ...offeringFromPage(page, name, boilerplate), name };
      // Not crawled: keep the name and URL for the reviewer.
      return { name, category: null, description: null, features: [], pricing: null, url };
    });
    if (offerings.length) {
      out.data.offerings = offerings;
      out.sources["offerings"] = html(fromMenu ? "high" : "medium");
    }

    // ---- CTAs: most repeated (header buttons) first ----
    const ctas = rankByFrequency(ctx.pages.flatMap((p) => collectCtas(p.$))).slice(0, 12);

    // ---- Funnels & channels ----
    const funnels = new Set<string>();
    const channels = new Set<string>(["Website"]);
    for (const page of ctx.pages) {
      const $ = page.$;
      $("form").each((_, form) => {
        const kind = classifyForm($, form);
        if (kind) funnels.add(kind);
      });
      const pageHtml = $.html();
      if (SCHEDULERS.test(pageHtml)) funnels.add("Online booking / scheduler");
      if (CHAT_WIDGETS.test(pageHtml)) channels.add("Live chat");
      if ($('a[href^="tel:"]').length) channels.add("Phone");
      if ($('a[href^="mailto:"]').length) channels.add("Email");
      if ($('a[href*="wa.me"], a[href*="whatsapp"]').length) channels.add("WhatsApp");
      if ($('a[href^="sms:"]').length) channels.add("Text message");
      if (/\b(financing|apply now|payment options)\b/i.test(page.text)) funnels.add("Financing options");
      if (/\b(refer a friend|referral program|referrals?)\b/i.test(page.text)) funnels.add("Referrals");
    }
    if (ctx.pagesMatching(/blog|news|articles|resources/).length || ctx.home.$('a[href*="/blog"]').length) {
      funnels.add("Content marketing (blog)");
    }
    if (ctas.some((c) => /free (estimate|quote|inspection|consult)/i.test(c))) funnels.add("Free estimate / consultation offer");

    out.data.market = {};
    if (ctas.length) {
      out.data.market.ctas = ctas;
      out.sources["market.ctas"] = html("high");
    }
    if (funnels.size) {
      out.data.market.funnels = [...funnels];
      out.sources["market.funnels"] = html("medium");
    }
    out.data.market.channels = [...channels];
    out.sources["market.channels"] = html("medium");

    // ---- People (team/about pages) ----
    const teamPages = ctx.pagesMatching(/team|staff|leadership|people|about|meet|agents|our-story/);
    const seen = new Set<string>();
    // The same person can appear on About and Team pages; keep the first.
    const people = teamPages.flatMap(collectPeople).filter((p) => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (people.length) {
      out.data.people = people.slice(0, 15);
      out.sources["people"] = html("medium", teamPages[0]?.url);
    }

    // ---- Content themes: section headings and blog titles ----
    const headings = ctx.pages.flatMap((p) =>
      p.$("main h2, main h3, article h2, h2, h3")
        .map((_, el) => clean(p.$(el).text()))
        .get(),
    );
    const blogTitles = ctx.pagesMatching(/blog|news|articles/).flatMap((p) =>
      p.$("article h2, article h3, .post-title, .entry-title, h2 a, h3 a")
        .map((_, el) => clean(p.$(el).text()))
        .get(),
    );

    const themes = rankByFrequency([...blogTitles, ...headings])
      .filter(
        (h) =>
          h.length >= 8 &&
          h.length <= 90 &&
          wordCount(h) >= 2 &&
          !isGenericHeading(h) &&
          !h.endsWith("?") &&
          !looksLikePersonName(h) &&
          !/^(meet|why|our team|frequently|follow|connect|get started|ready to|check out)/i.test(h) &&
          !/^\d[\d,.%+]*\s+\w+$/.test(h), // stat counters like "10 Minutes", "500+ Clients"
      )
      // Framer/Webflow repeat headings for mobile and desktop layouts.
      .filter((h, i, all) => all.findIndex((x) => x.toLowerCase().replace(/\W/g, "") === h.toLowerCase().replace(/\W/g, "")) === i)
      .slice(0, 12);
    if (themes.length) {
      out.data.extras = { contentThemes: themes };
      out.sources["extras.contentThemes"] = html("low");
    }

    return out;
  },
};
