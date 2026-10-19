// Light runtime check for knowledge bases coming from the browser.

import type { KnowledgeBase } from "@/types/knowledge";

const SECTIONS = ["foundation", "positioning", "market", "branding", "onlinePresence", "extras", "sources"] as const;

export function isKnowledgeBase(value: unknown): value is KnowledgeBase {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.sourceUrl === "string" &&
    Array.isArray(v.people) &&
    Array.isArray(v.offerings) &&
    SECTIONS.every((s) => typeof v[s] === "object" && v[s] !== null)
  );
}
