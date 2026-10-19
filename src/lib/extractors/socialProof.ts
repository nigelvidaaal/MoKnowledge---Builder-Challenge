// Extractor 7: social proof and messaging signals (the "think bigger" layer).

import type { Faq, Testimonial } from "@/types/knowledge";
import type { Extractor } from "./types";
import { result } from "./types";
import { clean, looksLikePersonName, sentences, wordCount } from "./text";

const TRUST =
  /\b(licen[sc]ed|bonded|insured|certified|accredited|award[- ]winning|awards?|bbb|a\+ rating|years? of experience|warrant(y|ies)|guarantee[d]?|family[- ]owned|locally owned|veteran[- ]owned|woman[- ]owned|since (19|20)\d{2}|license #|lic\.? #|member of|top[- ]rated|5[- ]star|five[- ]star)\b/i;
const PRESS = /\b(as (seen|featured) (on|in)|featured in|in the news|press release|named (one of|best)|voted (best|#1))\b/i;
const COMMUNITY =
  /\b(community|charit(y|ies|able)|donat(e|ion|es)|sponsor(s|ed|ing)?|volunteer|give back|giving back|non-?profit|eco[- ]friendly|sustainab(le|ility)|environment(al|ally)?|green|our (mission|values)|we believe)\b/i;
const SEASONAL =
  /\b(spring|summer|fall|autumn|winter|holiday|black friday|tax season|back[- ]to[- ]school|new year|storm season|hurricane season|limited[- ]time|this (month|season)|through (january|february|march|april|may|june|july|august|september|october|november|december))\b/i;
const DISCLAIMER =
  /\b(disclaimer|not (be )?responsible|results (may|will) vary|for informational purposes|not (legal|financial|tax|medical) advice|equal housing|nmls|licensed in|subject to (credit )?approval|terms (and|&) conditions apply|apr)\b/i;

// Headings like "Ready to get started?" are calls to action, not FAQs.
const SALES_QUESTION = /^(ready|want|looking|need|interested|have (a )?questions?|got questions?|why wait|what are you waiting)\b/i;
const USP_HEADING = /why (choose|us|work with)|what (sets|makes) us|our (difference|promise|advantage|commitment)|benefits|why .{0,30}\?/i;

function dedupeBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function uniq(items: string[], max: number): string[] {
  const seen = new Set<string>();
  return items
    .filter((i) => {
      const k = i.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}

export const socialProofExtractor: Extractor = {
  name: "social-proof",
  run(ctx) {
    const testimonials: Testimonial[] = [];
    const faqs: Faq[] = [];
    const trust: string[] = [];
    const press: string[] = [];
    const community: string[] = [];
    const seasonal: string[] = [];
    const disclaimers: string[] = [];
    const usps: string[] = [];

    for (const page of ctx.pages) {
      const $ = page.$;

      $('blockquote, [class*="testimonial"], [class*="review"]:not([class*="reviews-"]), [itemprop="review"]').each((_, el) => {
        const node = $(el);
        // A wrapper containing a blockquote: skip it, the inner blockquote is handled on its own.
        if (node.find("blockquote").length) return; // the inner blockquote will be visited itself
        const author = clean(node.find('cite, [class*="author"], [class*="name"], footer, strong').first().text()).replace(/^[-—–\s]+/, "");
        let quote = clean(node.text());
        if (author) quote = clean(quote.replace(author, ""));
        quote = quote.replace(/[-—–\s]+$/, "").replace(/^[“"']+|[”"']+$/g, "").trim();
        if (wordCount(quote) < 6 || quote.length > 600) return;
        testimonials.push({ quote, author: author && author.length < 60 ? author : null, rating: null });
      });

      // Testimonial cards: a short person-name heading next to a long paragraph.
      if (/testimonial|review/i.test(new URL(page.url).pathname)) {
        $("h2, h3, h4, h5, h6, strong, cite").each((_, el) => {
          const author = clean($(el).text());
          if (!looksLikePersonName(author) && !/^[A-Z][a-z]+ [A-Z]\.?$/.test(author)) return;
          const card = $(el).parent();
          const quote = clean(card.text().replace(author, "")).replace(/^[“"']+|[”"']+$/g, "");
          if (wordCount(quote) >= 12 && wordCount(quote) <= 250) testimonials.push({ quote, author, rating: null });
        });
      }

      $("details").each((_, el) => {
        const q = clean($(el).find("summary").text());
        const a = clean($(el).clone().find("summary").remove().end().text());
        if (q.endsWith("?") && a) faqs.push({ question: q, answer: a.slice(0, 800) });
      });
      $("h2, h3, h4, h5, dt, button, [class*=question]").each((_, el) => {
        const q = clean($(el).text());
        if (!q.endsWith("?") || q.length > 200 || wordCount(q) < 3 || USP_HEADING.test(q) || SALES_QUESTION.test(q)) return;
        // The answer must be prose right after the question, not a list.
        const next = $(el).next();
        if (!next.is("p, dd, div, span, section")) return;
        const a = clean(next.text());
        if (wordCount(a) >= 5) faqs.push({ question: q, answer: a.slice(0, 800) });
      });

      $("h2, h3").each((_, el) => {
        if (!USP_HEADING.test($(el).text())) return;
        $(el)
          .nextAll("ul, ol")
          .first()
          .find("li")
          .each((__, li) => {
            const t = clean($(li).text());
            if (t.length > 4 && t.length < 160) usps.push(t);
          });
      });

      // Sentence-level signals: sort each sentence into the matching lists.
      for (const s of sentences(page.text)) {
        if (s.length > 260 || wordCount(s) < 3) continue;
        if (TRUST.test(s)) trust.push(s);
        if (PRESS.test(s) && wordCount(s) >= 5) press.push(s);
        if (COMMUNITY.test(s) && wordCount(s) >= 6) community.push(s);
        // Seasonal AND an offer word, so "our summer employee" doesn't count.
        if (SEASONAL.test(s) && /(\$\d|\d+%|\b(off|special|offer|discount|save|deal|book|schedule)\b)/i.test(s)) seasonal.push(s);
        if (DISCLAIMER.test(s)) disclaimers.push(s);
      }
      // Short trust phrases often live in list items rather than sentences.
      $("li").each((_, li) => {
        const t = clean($(li).text());
        if (t.length < 120 && TRUST.test(t)) trust.push(t);
      });
    }

    // The same FAQ often appears on several pages; keep one per question.
    const faqSeen = new Set<string>();
    const uniqueFaqs = faqs.filter((f) => {
      const k = f.question.toLowerCase();
      if (faqSeen.has(k)) return false;
      faqSeen.add(k);
      return true;
    });

    const out = result({
      extras: {
        // Dedupe on the first 80 characters (sliders repeat the same review) and keep at most 10.
        testimonials: dedupeBy(testimonials, (t) => t.quote.slice(0, 80).toLowerCase()).slice(0, 10),
        faqs: uniqueFaqs.slice(0, 20),
        trustSignals: uniq(trust, 10),
        pressMentions: uniq(press, 6),
        communityAndValues: uniq(community, 6),
        seasonalMessaging: uniq(seasonal, 6),
        uniqueSellingPoints: uniq(usps, 8),
        compliance: { disclaimers: uniq(disclaimers, 6) },
      },
    });
    const src = (confidence: "high" | "medium" | "low") => ({ method: "html" as const, confidence, url: ctx.home.url });

    const mark = (path: string, list: unknown[], confidence: "high" | "medium" | "low") => {
      if (list.length) out.sources[path] = src(confidence);
    };
    mark("extras.testimonials", testimonials, "medium");
    mark("extras.faqs", uniqueFaqs, "high");
    mark("extras.trustSignals", trust, "medium");
    mark("extras.pressMentions", press, "low");
    mark("extras.communityAndValues", community, "low");
    mark("extras.seasonalMessaging", seasonal, "low");
    mark("extras.uniqueSellingPoints", usps, "medium");
    mark("extras.compliance.disclaimers", disclaimers, "medium");
    return out;
  },
};
