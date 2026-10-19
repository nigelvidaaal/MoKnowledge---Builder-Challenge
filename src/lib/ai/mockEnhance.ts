// MOCK AI enrichment: clearly labeled placeholder values, no LLM is called.

import type { FieldSource, KnowledgeBase } from "@/types/knowledge";

/** Every field the mock (and the prompts behind it) can fill. */
export const AI_FILLABLE = [
  "foundation.businessModel",
  "foundation.companyRole",
  "positioning.pitch",
  "market.buyers",
  "market.customerNeeds",
  "market.idealPersona",
  "market.industryGroupings",
  "branding.writingStyle",
  "branding.artStyle",
  "extras.uniqueSellingPoints",
  "extras.contentThemes",
];

const MOCK: FieldSource = { method: "ai_mock", confidence: "low" };

function list(items: string[], max = 3): string {
  const xs = items.slice(0, max);
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** True if the field is empty or low confidence AND wasn't edited by a person. */
function canFillField(kb: KnowledgeBase, path: string, value: unknown): boolean {
  const src = kb.sources[path];
  if (src?.method === "user") return false;
  const empty = value === null || value === "" || (Array.isArray(value) && value.length === 0);
  return empty || src?.confidence === "low";
}

function inferBuyers(text: string): string[] {
  const buyers: string[] = [];
  const has = (re: RegExp) => re.test(text);
  if (has(/\b(homeowners?|residential|your home|families)\b/i)) buyers.push("Residential homeowners");
  if (has(/\b(commercial|businesses|business owners|companies|offices?)\b/i)) buyers.push("Commercial / business clients");
  if (has(/\b(property managers?|landlords?|hoa|multi-?family)\b/i)) buyers.push("Property managers");
  if (has(/\b(agricultur|farm|ranch)\w*/i)) buyers.push("Agricultural clients");
  if (has(/\b(contractors?|builders?)\b/i)) buyers.push("Contractors and builders");
  if (has(/\b(buyers?|sellers?|investors?)\b/i)) buyers.push("Home buyers, sellers and investors");
  return buyers.length ? buyers : ["Local customers"];
}

function describeStyle(samples: string[]): string | null {
  if (samples.length < 2) return null;
  const words = samples.join(" ").split(/\s+/).length / samples.length;
  const addressesReader = samples.filter((s) => /\byou(r)?\b/i.test(s)).length >= samples.length / 2;
  const firstPerson = samples.filter((s) => /\b(we|our|us)\b/i.test(s)).length >= samples.length / 2;
  const energetic = samples.some((s) => s.includes("!"));
  return [
    `${energetic ? "Upbeat and" : "Calm,"} ${words < 16 ? "concise" : "explanatory"} copy with ${words < 16 ? "short" : "medium-length"} sentences (about ${Math.round(words)} words).`,
    firstPerson ? "Speaks as a team (\"we\", \"our\")" : "Speaks about the company in the third person",
    addressesReader ? "and talks directly to the reader (\"you\")." : "and rarely addresses the reader directly.",
    "Focuses on practical reassurance over hype.",
  ].join(" ");
}

export function mockEnhance(input: KnowledgeBase, only?: string[]): { knowledge: KnowledgeBase; filled: string[] } {
  const kb: KnowledgeBase = structuredClone(input);
  const filled: string[] = [];
  // `only` limits the fill to one section's fields.
  const allowed = (path: string) => !only || only.includes(path);
  const canFill = (k: KnowledgeBase, path: string, value: unknown) => allowed(path) && canFillField(k, path, value);
  const set = (path: string, apply: () => void) => {
    apply();
    kb.sources[path] = MOCK;
    filled.push(path);
  };

  const name = kb.foundation.name ?? "This business";
  const offerings = kb.offerings.map((o) => o.name);
  const places = kb.foundation.serviceLocations;
  const corpus = [kb.foundation.overview, kb.positioning.foundingStory, ...kb.extras.voiceSamples, ...kb.offerings.map((o) => o.description)]
    .filter(Boolean)
    .join(" ");
  const buyers = inferBuyers(corpus);
  const since = kb.foundation.yearFounded ? ` since ${kb.foundation.yearFounded}` : "";
  const where = places.length ? ` in ${list(places)}` : "";
  const what = offerings.length ? list(offerings.map((o) => o.toLowerCase())) : "its services";

  if (canFill(kb, "market.buyers", kb.market.buyers)) set("market.buyers", () => (kb.market.buyers = buyers));

  if (canFill(kb, "market.industryGroupings", kb.market.industryGroupings) && offerings.length) {
    set("market.industryGroupings", () => (kb.market.industryGroupings = offerings.slice(0, 6)));
  }

  if (canFill(kb, "foundation.businessModel", kb.foundation.businessModel)) {
    const pricing = [...new Set(kb.offerings.map((o) => o.pricing).filter(Boolean))].slice(0, 2);
    set("foundation.businessModel", () => {
      kb.foundation.businessModel = `Direct service model selling ${what} to ${list(buyers.map((b) => b.toLowerCase()), 2)}${where}${pricing.length ? `, priced ${list(pricing as string[])}` : ""}.`;
    });
  }

  if (canFill(kb, "foundation.companyRole", kb.foundation.companyRole)) {
    set("foundation.companyRole", () => {
      kb.foundation.companyRole = `Service provider specializing in ${what}${where}.`;
    });
  }

  if (canFill(kb, "positioning.pitch", kb.positioning.pitch)) {
    const proof = kb.extras.uniqueSellingPoints[0] ?? kb.extras.trustSignals[0];
    const cta = kb.market.ctas[0];
    set("positioning.pitch", () => {
      kb.positioning.pitch = [
        `${name} has helped ${buyers[0].toLowerCase()}${where}${since} with ${what}.`,
        proof ? `${proof.replace(/\.$/, "")}.` : null,
        cta ? `${cta.replace(/\.$/, "")} today.` : null,
      ]
        .filter(Boolean)
        .join(" ");
    });
  }

  if (canFill(kb, "market.customerNeeds", kb.market.customerNeeds)) {
    set("market.customerNeeds", () => {
      kb.market.customerNeeds = `Customers need ${what} done right the first time, with clear pricing and a team they can trust${where}. ${
        kb.extras.faqs.length ? `Common questions include: ${list(kb.extras.faqs.map((f) => `"${f.question}"`), 2)}.` : ""
      }`.trim();
    });
  }

  if (canFill(kb, "market.idealPersona", kb.market.idealPersona)) {
    set("market.idealPersona", () => {
      kb.market.idealPersona = `A ${buyers[0].toLowerCase().replace(/s$/, "")}${where} who needs ${what} and values reliability, transparent pricing and local expertise over the cheapest quote.`;
    });
  }

  if (canFill(kb, "branding.writingStyle", kb.branding.writingStyle)) {
    const style = describeStyle(kb.extras.voiceSamples);
    if (style) set("branding.writingStyle", () => (kb.branding.writingStyle = style));
  }

  if (canFill(kb, "branding.artStyle", kb.branding.artStyle) && (kb.branding.colors.length || kb.branding.fonts.length)) {
    set("branding.artStyle", () => {
      kb.branding.artStyle = `Clean, professional look built on ${list(kb.branding.colors.slice(0, 3))}${
        kb.branding.fonts.length ? ` with ${list(kb.branding.fonts, 2)} typography` : ""
      }. (Mock: a vision model would describe the logo and imagery.)`;
    });
  }

  if (canFill(kb, "extras.uniqueSellingPoints", kb.extras.uniqueSellingPoints) && kb.extras.trustSignals.length) {
    set("extras.uniqueSellingPoints", () => {
      kb.extras.uniqueSellingPoints = kb.extras.trustSignals.slice(0, 3).map((t) => t.replace(/\.$/, ""));
    });
  }

  if (canFill(kb, "extras.contentThemes", kb.extras.contentThemes) && (offerings.length || kb.extras.faqs.length)) {
    set("extras.contentThemes", () => {
      kb.extras.contentThemes = [
        ...offerings.slice(0, 3).map((o) => `How to choose the right ${o.toLowerCase()}`),
        ...kb.extras.faqs.slice(0, 3).map((f) => f.question),
      ];
    });
  }

  kb.updatedAt = new Date().toISOString();
  return { knowledge: kb, filled };
}
