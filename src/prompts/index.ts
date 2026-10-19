// Example prompts for LLM enrichment.
//   - A clear role and the downstream purpose (the model writes better when it knows the output
//     feeds MoSocial / MoMail / MoBlogs).
//   - Scraped data in a delimited block, separate from instructions, so text on a website can't
//     masquerade as instructions (prompt injection).
//   - An exact JSON output schema, so results drop straight into the knowledge base.
//   - Grounding rules: null over guessing, plus quoted evidence per field so a human can verify
//     claims quickly.
//   - Few-shot style guidance through a short example of good vs. bad output.

import type { KnowledgeBase } from "@/types/knowledge";
import { GROUNDING_RULES, scrapedBlock } from "./shared";

export interface PromptDefinition {
  id: string;
  title: string;
  fills: string[];
  purpose: string;
  build: (kb: KnowledgeBase, pageText: Record<string, string>) => { system: string; user: string };
}

/** Only send the model what it needs: smaller input, less distraction, lower cost. */
function businessDigest(kb: KnowledgeBase) {
  return {
    name: kb.foundation.name,
    website: kb.sourceUrl,
    overview: kb.foundation.overview,
    industryHint: kb.foundation.industry,
    serviceLocations: kb.foundation.serviceLocations,
    yearFounded: kb.foundation.yearFounded,
    offerings: kb.offerings.map((o) => ({ name: o.name, description: o.description, pricing: o.pricing })),
    ctas: kb.market.ctas,
    funnels: kb.market.funnels,
    testimonials: kb.extras.testimonials.slice(0, 5),
    faqs: kb.extras.faqs.slice(0, 8).map((f) => f.question),
    trustSignals: kb.extras.trustSignals,
    uniqueSellingPoints: kb.extras.uniqueSellingPoints,
  };
}

export const PROMPTS: PromptDefinition[] = [
  {
    id: "market-profile",
    title: "Market & positioning profile",
    fills: [
      "positioning.pitch",
      "market.buyers",
      "market.customerNeeds",
      "market.idealPersona",
      "market.industryGroupings",
      "foundation.businessModel",
      "foundation.companyRole",
      "foundation.industry",
    ],
    purpose: "Turns scattered facts into the strategic summary every app uses to decide who it's talking to and why they should care.",
    build: (kb, pageText) => ({
      system: `You are a senior marketing strategist building a business profile for MoFlo, an AI platform that writes social posts, emails and blog articles for small businesses. Downstream writers will rely on your profile to sound like they deeply understand this business and its customers.

${GROUNDING_RULES}`,
      user: `Build the market and positioning profile for this business.

${scrapedBlock({ ...businessDigest(kb), homepageText: pageText.home?.slice(0, 6000), aboutText: pageText.about?.slice(0, 4000) })}

Return JSON with this schema:
{
  "industry": string | null,                // short label, e.g. "Water Well Drilling and Services"
  "businessModel": string | null,           // one sentence: how they make money and from whom (B2C, B2B, recurring, per project...)
  "companyRole": string | null,             // one sentence: what role they play for customers
  "pitch": string | null,                   // 3–5 sentences in the company's own voice: who they serve, what they do, why choose them. Use their real differentiators.
  "buyers": string[],                       // distinct buyer types, e.g. ["Residential homeowners", "Agricultural clients"]
  "customerNeeds": string | null,           // 3–5 sentences: the problems and outcomes customers care about
  "idealPersona": string | null,            // 3–5 sentences describing one ideal customer: who, where, situation, what they value
  "industryGroupings": string[],            // 3–8 sub-categories of their work
  "evidence": { "field": string, "quote": string, "url": string }[]
}

Good pitch: "Family-owned since 1980, Bee Cave Drilling builds water wells across the Texas Hill Country — handling permits, drilling and pump installation with clear pricing and financing."
Bad pitch: "Bee Cave Drilling is a leading provider of innovative water solutions committed to excellence." (generic, no facts)`,
    }),
  },
  {
    id: "brand-voice",
    title: "Writing style & brand voice guide",
    fills: ["branding.writingStyle"],
    purpose: "Gives every content app a concrete voice to imitate, built from the company's real sentences instead of adjectives.",
    build: (kb) => ({
      system: `You are a brand copy editor. You analyze how a company writes so other writers can match its voice exactly.

${GROUNDING_RULES}`,
      user: `Analyze this company's writing style from its own words.

${scrapedBlock({
  name: kb.foundation.name,
  voiceSamples: kb.extras.voiceSamples,
  headlines: kb.extras.contentThemes,
  ctas: kb.market.ctas,
  pitchDraft: kb.positioning.pitch,
})}

Return JSON:
{
  "writingStyle": string,        // 3–4 sentences: tone, formality, sentence length, how they address the reader ("you"/"we"), use of jargon
  "doList": string[],            // 3–5 specific habits to copy, each with an example from the samples
  "dontList": string[],          // 3–5 things this brand avoids (based on what is absent or contrary in the samples)
  "signaturePhrases": string[],  // recurring phrases or word choices worth reusing
  "readingLevel": "simple" | "moderate" | "technical",
  "evidence": { "field": string, "quote": string, "url": string }[]
}

Base every claim on the samples. If there are fewer than 3 samples, set "writingStyle" to null and explain in evidence.`,
    }),
  },
  {
    id: "offerings-normalizer",
    title: "Offerings cleanup & categorization",
    fills: ["offerings[].category", "offerings[].features", "offerings[].pricing"],
    purpose: "Turns messy service-page scrapes into clean, categorized offerings that MoBlogs and MoMail can write about one by one.",
    build: (kb) => ({
      system: `You are a product catalog specialist. You turn rough scraped service pages into a clean, consistent catalog without inventing anything.

${GROUNDING_RULES}`,
      user: `Clean up and categorize these offerings scraped from ${kb.foundation.name ?? "the company"}'s website.

${scrapedBlock(kb.offerings)}

For each offering return:
{
  "name": string,               // keep the company's name for it; fix only casing and obvious typos
  "category": string,           // one short category; reuse the same categories across offerings (e.g. "Service", "System Installation", "Financial Service")
  "description": string | null, // 1–2 sentences, plain language
  "features": string[],         // concrete features only, max 6, no marketing fluff
  "pricing": string | null,     // copy pricing exactly as stated ("Free Estimate", "Per Project", "$149 per service call"); null if not stated
  "mergeWith": string | null    // name of another offering if these are duplicates
}
Return { "offerings": [...], "evidence": [...] }. Keep the original order.`,
    }),
  },
  {
    id: "content-angles",
    title: "Differentiators & content angles",
    fills: ["extras.uniqueSellingPoints", "extras.contentThemes"],
    purpose: "Finds what to emphasize against competitors and which topics to write about, from evidence the site already shows.",
    build: (kb) => ({
      system: `You are a content strategist for local businesses. You find the angles a company can credibly claim and the topics its customers care about.

${GROUNDING_RULES}`,
      user: `Find differentiators and content topics for this company.

${scrapedBlock({
  ...businessDigest(kb),
  voiceSamples: kb.extras.voiceSamples,
  existingThemes: kb.extras.contentThemes,
})}

Return JSON:
{
  "uniqueSellingPoints": string[], // 3–5 claims the data proves (years in business, licenses, guarantees, specialties). No generic claims like "great service".
  "contentThemes": string[],       // 5–8 blog/email topics drawn from their offerings and customer questions
  "evidence": { "field": string, "quote": string, "url": string }[]
}`,
    }),
  },
  {
    id: "art-style",
    title: "Visual / art style description (vision model)",
    fills: ["branding.artStyle"],
    purpose: "Describes the look so MoSocial can generate or choose on-brand images.",
    build: (kb) => ({
      system: `You are a brand designer describing a company's visual identity for an image-generation system. Describe only what you can see in the provided images and color data.

${GROUNDING_RULES}`,
      user: `Images attached: the company logo${kb.branding.logos[1] ? " and homepage hero image" : ""}.
${scrapedBlock({ logos: kb.branding.logos, colors: kb.branding.colors, fonts: kb.branding.fonts })}

Return JSON:
{
  "artStyle": string,          // 2–4 sentences: overall aesthetic, composition, typography feel, color mood
  "imageGuidance": string[],   // 3–5 rules for on-brand imagery (e.g. "real crews on job sites, not stock models")
  "avoid": string[],           // visual choices that would clash with this brand
  "evidence": { "field": string, "quote": string, "url": string }[]
}
If the logo image cannot be loaded, describe only from colors and fonts and say so in evidence.`,
    }),
  },
];

export function getPrompt(id: string): PromptDefinition | undefined {
  return PROMPTS.find((p) => p.id === id);
}
