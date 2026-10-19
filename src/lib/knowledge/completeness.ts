// Scores how complete a knowledge base is, and lists what's missing.

import type { KnowledgeBase } from "@/types/knowledge";

interface Check {
  label: string;
  section: string;
  weight: number;
  ok: (kb: KnowledgeBase) => boolean;
}

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "");

/** Every rule with its weight. Offerings (8) and pitch (6) weigh more than fonts (1). */
const CHECKS: Check[] = [
  { label: "Company name", section: "foundation", weight: 5, ok: (k) => has(k.foundation.name) },
  { label: "Overview", section: "foundation", weight: 5, ok: (k) => has(k.foundation.overview) },
  { label: "Industry", section: "foundation", weight: 3, ok: (k) => has(k.foundation.industry) },
  { label: "Main address", section: "foundation", weight: 2, ok: (k) => has(k.foundation.mainAddress) },
  { label: "Phone or email", section: "foundation", weight: 2, ok: (k) => has(k.foundation.phone) || has(k.foundation.email) },
  { label: "Service locations", section: "foundation", weight: 3, ok: (k) => has(k.foundation.serviceLocations) },
  { label: "Year founded", section: "foundation", weight: 1, ok: (k) => has(k.foundation.yearFounded) },
  { label: "Pitch", section: "positioning", weight: 6, ok: (k) => has(k.positioning.pitch) },
  { label: "Founding story", section: "positioning", weight: 2, ok: (k) => has(k.positioning.foundingStory) },
  { label: "Target buyers", section: "market", weight: 4, ok: (k) => has(k.market.buyers) },
  { label: "Ideal customer persona", section: "market", weight: 4, ok: (k) => has(k.market.idealPersona) },
  { label: "Customer needs", section: "market", weight: 3, ok: (k) => has(k.market.customerNeeds) },
  { label: "Calls to action", section: "market", weight: 3, ok: (k) => has(k.market.ctas) },
  { label: "Writing style", section: "branding", weight: 5, ok: (k) => has(k.branding.writingStyle) },
  { label: "Brand colors", section: "branding", weight: 3, ok: (k) => has(k.branding.colors) },
  { label: "Fonts", section: "branding", weight: 1, ok: (k) => has(k.branding.fonts) },
  { label: "Brand photos", section: "branding", weight: 2, ok: (k) => has(k.branding.images) },
  { label: "Logo", section: "branding", weight: 2, ok: (k) => has(k.branding.logos) },
  { label: "Social profiles", section: "onlinePresence", weight: 3, ok: (k) => has(k.onlinePresence.socials) },
  { label: "Key people", section: "people", weight: 2, ok: (k) => has(k.people) },
  { label: "Offerings", section: "offerings", weight: 8, ok: (k) => has(k.offerings) },
  { label: "Voice samples", section: "voice", weight: 4, ok: (k) => k.extras.voiceSamples.length >= 2 },
  { label: "Testimonials", section: "proof", weight: 3, ok: (k) => has(k.extras.testimonials) },
  { label: "FAQs", section: "faqs", weight: 3, ok: (k) => has(k.extras.faqs) },
  { label: "Trust signals", section: "proof", weight: 3, ok: (k) => has(k.extras.trustSignals) },
  { label: "Differentiators", section: "voice", weight: 3, ok: (k) => has(k.extras.uniqueSellingPoints) },
];

/** Fields at or above this weight are "major". */
export const MAJOR_WEIGHT = 4;

export interface Completeness {
  score: number; // 0–100
  missing: { label: string; section: string; major: boolean }[];
}

export function completeness(kb: KnowledgeBase): Completeness {
  const total = CHECKS.reduce((s, c) => s + c.weight, 0);
  const earned = CHECKS.filter((c) => c.ok(kb)).reduce((s, c) => s + c.weight, 0);
  return {
    score: Math.round((earned / total) * 100),
    missing: CHECKS.filter((c) => !c.ok(kb))
      .sort((a, b) => b.weight - a.weight)
      .map(({ label, section, weight }) => ({ label, section, major: weight >= MAJOR_WEIGHT })),
  };
}
