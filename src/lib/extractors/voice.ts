// Extractor 8: the company's own words.

import type { Extractor } from "./types";
import { result } from "./types";
import { clean, mainContent, sentences, wordCount } from "./text";

const ORIGIN = /\b(founded|started|began|established|opened|since (19|20)\d{2}|history|our story|family[- ]owned|generations?|grew up|dream|vision)\b/i;
const BOILERPLATE = /cookie|javascript|©|copyright|all rights reserved|privacy|terms|click here|subscribe|newsletter|log ?in|sign ?up|captcha/i;

/** Scores how much a sentence sounds like the brand talking to a customer. */
function voiceScore(s: string): number {
  let score = 0;
  if (/\b(we|we're|we've|our|us)\b/i.test(s)) score += 2;
  if (/\b(you|your|you're)\b/i.test(s)) score += 2;
  if (/[!]/.test(s)) score += 1;
  const words = wordCount(s);
  if (words >= 10 && words <= 28) score += 2;
  return score;
}

export const voiceExtractor: Extractor = {
  name: "voice",
  run(ctx) {
    const out = result();

    // ---- Voice samples: About pages first ----
    const pool = [...ctx.pagesMatching(/about|story|why|mission/), ctx.home, ...ctx.pages].flatMap((page) =>
      mainContent(page.$)
        .find("p")
        .map((_, el) => clean(page.$(el).text()))
        .get()
        .flatMap(sentences),
    );
    const samples = [...new Set(pool)]
      .filter((s) => wordCount(s) >= 8 && wordCount(s) <= 40 && !BOILERPLATE.test(s))
      .map((s) => ({ s, score: voiceScore(s) }))
      .filter((x) => x.score >= 4)
      .sort((a, b) => b.score - a.score)
      // Five examples are enough for an LLM to copy the voice.
      .slice(0, 5)
      .map((x) => x.s);
    if (samples.length) {
      out.data.extras = { voiceSamples: samples };
      out.sources["extras.voiceSamples"] = { method: "html", confidence: "high", url: ctx.home.url };
    }

    // ---- Founding story ----
    const aboutPages = ctx.pagesMatching(/about|story|history|who-we-are/);
    for (const page of aboutPages) {
      const paragraphs = mainContent(page.$)
        .find("p")
        .map((_, el) => clean(page.$(el).text()))
        .get()
        .filter((p) => ORIGIN.test(p) && wordCount(p) >= 15 && !BOILERPLATE.test(p));
      if (paragraphs.length) {
        out.data.positioning = { foundingStory: paragraphs.slice(0, 2).join(" ") };
        out.sources["positioning.foundingStory"] = { method: "html", confidence: "medium", url: page.url };
        break;
      }
    }

    // ---- Pitch draft from the hero ----
    const $ = ctx.home.$;
    const h1 = clean($("h1").first().text());
    const lead = clean($("h1").first().nextAll("p").first().text()) || clean(mainContent($).find("p").first().text());
    if (h1 && lead && wordCount(lead) >= 6) {
      out.data.positioning = { ...(out.data.positioning ?? {}), pitch: `${h1}. ${sentences(lead)[0] ?? lead}`.replace(/\.\./g, ".") };
      out.sources["positioning.pitch"] = { method: "html", confidence: "low", url: ctx.home.url };
    }

    return out;
  },
};
