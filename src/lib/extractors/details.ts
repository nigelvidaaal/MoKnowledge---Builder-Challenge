// Fills the gaps JSON-LD leaves: phone, email, address, founding year,
// legal entity type, service areas, and policy pages. Patterns are less
// certain than structured data, so most of these are "medium".

import type { FieldSource } from "@/types/knowledge";
import type { Extractor } from "./types";
import { result } from "./types";
import { clean, formatPhone } from "./text";

// regex and key words that are important for the site's knowledge base 
const FOUNDED = /\b(?:since|established(?:\s+in)?|est\.?|founded(?:\s+in)?|serving[^.]{0,40}?since)\s+((?:19|20)\d{2})\b/i;

const LEGAL_ENTITY = /\b[A-Z][\w&'.\- ]{1,60}?,?\s+(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|LLP|PLLC|Ltd\.?|Co\.)(?=[\s.,)]|$)/;

const US_PHONE = /(?:\+?1[\s.-]?)?\(?\b([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const US_ADDRESS = /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Z0-9][\w.' -]{2,40}?\s(?:St|Street|Rd|Road|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pkwy|Parkway|Hwy|Highway|Ct|Court|Pl|Place|Cir|Circle)\.?(?:,?\s+(?:Suite|Ste\.?|#|Unit)\s*[\w-]+)?,?\s+[A-Z][a-zA-Z .]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

const SERVING = /\b(?:proudly\s+)?serv(?:ing|e|es)\s+(?:the\s+)?((?:[A-Z][a-zA-Z.]+\s?){1,4}(?:,\s*(?:and\s+)?(?:[A-Z][a-zA-Z.]+\s?){1,4}){0,8}(?:\s+and\s+(?:[A-Z][a-zA-Z.]+\s?){1,4})?)/;

/**
 * tries explicit links first (high confidence), then text patterns on
 * about/contact pages first (medium/low), then legal entity and policy links.
 * each value records how it was found, so a regex guess never silently overrides
 *      structured data.
 */
export const detailsExtractor: Extractor = {
  name: "details",
  run(ctx) {
    const out = result();
    // Shortcut: writing to `sources` writes to out.sources (same object).
    const sources: Record<string, FieldSource> = out.sources;
    const foundation: NonNullable<typeof out.data.foundation> = {};
    // Helper: a "pattern" source, medium confidence unless told otherwise.
    const pattern = (url: string, confidence: FieldSource["confidence"] = "medium"): FieldSource => ({
      method: "pattern",
      confidence,
      url,
    });

    // --- Phone & email: tel:/mailto: links are explicit, so "high". ---
    for (const page of ctx.pages) {
      const { $ } = page;
      if (!foundation.phone) {
        // The first click-to-call link on the page.
        const tel = $('a[href^="tel:"]').first().attr("href");
        // Remove the tel: prefix and check it's a real phone number.
        const m = tel?.replace(/^tel:/, "").match(US_PHONE);
        if (m) {
          foundation.phone = formatPhone(m[0]);
          sources["foundation.phone"] = { method: "html", confidence: "high", url: page.url };
        }
      }
      if (!foundation.email) {
        const mail = $('a[href^="mailto:"]').first().attr("href");
        // Remove mailto: and anything after ? (like ?subject=Hello).
        const addr = mail?.replace(/^mailto:/, "").split("?")[0];
        if (addr && EMAIL.test(addr)) {
          foundation.email = addr.toLowerCase();
          sources["foundation.email"] = { method: "html", confidence: "high", url: page.url };
        }
      }
    }

    const ordered = [...ctx.pagesMatching(/about|contact|story|history/), ...ctx.pages];

    for (const page of ordered) {
      const text = page.text;

      if (!foundation.phone) {
        const m = text.match(US_PHONE);
        if (m) {
          foundation.phone = formatPhone(m[0]);
          sources["foundation.phone"] = pattern(page.url, "low");
        }
      }
      if (!foundation.email) {
        const m = text.match(EMAIL);
        // Image filenames like logo@2x.png look like emails to the regex; skip them.
        if (m && !/\.(png|jpe?g|gif|webp|svg)$/i.test(m[0])) {
          foundation.email = m[0].toLowerCase();
          sources["foundation.email"] = pattern(page.url, "low");
        }
      }
      if (!foundation.yearFounded) {
        const m = text.match(FOUNDED);
        // m[1] is the captured year.
        const year = m ? Number(m[1]) : NaN;
        // Sanity check: a plausible past year.
        if (year >= 1850 && year <= new Date().getFullYear()) {
          foundation.yearFounded = year;
          sources["foundation.yearFounded"] = pattern(page.url);
        }
      }
      if (!foundation.mainAddress) {
        // An <address> tag is the most explicit place for an address.
        const addressEl = page.$("address").first();
        // Address inside <address> (high confidence)...
        const fromTag = addressEl.length ? clean(addressEl.text()).match(US_ADDRESS)?.[0] : undefined;
        // ...or anywhere in the page text (medium).
        const m = fromTag ?? text.match(US_ADDRESS)?.[0];
        if (m) {
          foundation.mainAddress = clean(m);
          sources["foundation.mainAddress"] = pattern(page.url, fromTag ? "high" : "medium");
        }
      }
      if (!foundation.serviceLocations) {
        const m = text.match(SERVING);
        if (m) {
          const places = m[1]
            // "Las Vegas, Henderson and Summerlin" -> ["Las Vegas", "Henderson", "Summerlin"].
            .split(/,|\band\b/)
            .map(clean)
            // Drop words that aren't places ("serving our customers").
            .filter((p) => p.length > 2 && p.length < 40 && !/^(our|you|your|customers?|clients?|homeowners?|businesses)$/i.test(p));
          if (places.length) {
            foundation.serviceLocations = places;
            sources["foundation.serviceLocations"] = pattern(page.url, "low");
          }
        }
      }
    }

    // --- Legal entity: usually in the copyright line in the footer. ---
    // The legal name is usually in the footer's copyright line.
    const footer = clean(ctx.home.$("footer").text()) || ctx.home.text;
    // Find the text starting at ©/copyright, up to 120 characters or a period.
    const copyright = footer.match(/(?:©|&copy;|copyright)[^.]{0,120}/i)?.[0] ?? footer;
    // Look in the copyright line first, then the whole homepage.
    const entity = copyright.match(LEGAL_ENTITY) ?? ctx.home.text.match(LEGAL_ENTITY);
    if (entity) {
      /**
       * ENTITY_NAMES: maps spelled variants (INCORPORATED, CORPORATION) to short labels (Inc,
       * Corp).
       * Why: Normalizes the legal entity type for display and filtering.
       */
      const ENTITY_NAMES: Record<string, string> = {
        LLC: "LLC", INC: "Inc", INCORPORATED: "Inc", CORP: "Corp", CORPORATION: "Corp",
        LLP: "LLP", PLLC: "PLLC", LTD: "Ltd", CO: "Co",
      };
      // "L.L.C." -> "LLC", "Inc." -> "INC", then map to a display label.
      const key = entity[1].replace(/\./g, "").toUpperCase();
      foundation.legalEntityType = ENTITY_NAMES[key] ?? key;
      sources["foundation.legalEntityType"] = pattern(ctx.home.url);
      // The full legal name without "© 2024": "Bee Cave Drilling, LLC".
      const fullName = clean(entity[0].replace(/^(?:©|copyright)\s*\d{4}\s*/i, ""));
      if (fullName.length < 80) {
        foundation.altNames = [fullName];
        sources["foundation.altNames"] = pattern(ctx.home.url, "low");
      }
    }

    if (Object.keys(foundation).length) out.data.foundation = foundation;

    // --- Compliance pages. ---
    let privacy: string | null = null;
    let terms: string | null = null;
    // Privacy and terms links are almost always in the footer of every page, so the homepage is
    // enough.
    ctx.home.$("a[href]").each((_, el) => {
      const a = ctx.home.$(el);
      // Check both the link text and its URL.
      const label = `${a.text()} ${a.attr("href")}`.toLowerCase();
      const href = new URL(a.attr("href")!, ctx.home.url).toString();
      // Keep the first match only.
      if (!privacy && /privacy/.test(label)) privacy = href;
      if (!terms && /terms|conditions/.test(label)) terms = href;
    });
    if (privacy || terms) {
      out.data.extras = { compliance: { privacyPolicyUrl: privacy, termsUrl: terms } };
      sources["extras.compliance"] = { method: "html", confidence: "high", url: ctx.home.url };
    }

    return out;
  },
};
