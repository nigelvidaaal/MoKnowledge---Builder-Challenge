// Combines extractor results into one knowledge base.
//   - Single values: keep the existing value unless the new one comes from a more trustworthy
//     source.
//   - Lists: union them and drop duplicates (case-insensitive for strings).

import type { Confidence, ExtractorResult, FieldSource, KnowledgeBase } from "@/types/knowledge";

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/** Objects that describe the same thing share one of these keys. */
const IDENTITY_KEYS = ["name", "question", "quote", "platform", "url", "title"] as const;

function identityOf(item: unknown): string {
  if (typeof item === "string") return item.trim().toLowerCase();
  if (isPlainObject(item)) {
    for (const k of IDENTITY_KEYS) {
      if (typeof item[k] === "string") return `${k}:${(item[k] as string).trim().toLowerCase()}`;
    }
  }
  return JSON.stringify(item);
}

/** Drops duplicates, combining objects that describe the same thing. */
function dedupe<T>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = identityOf(item);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, item);
    } else if (isPlainObject(existing) && isPlainObject(item)) {
      const combined: Record<string, unknown> = { ...existing };
      for (const [k, v] of Object.entries(item)) {
        const cur = combined[k];
        const curEmpty = cur === null || cur === undefined || cur === "" || (Array.isArray(cur) && cur.length === 0);
        // Prefer the more descriptive string (e.g. a full job title over "Founder").
        const longer = typeof v === "string" && typeof cur === "string" && v.length > cur.length;
        if (curEmpty || longer) combined[k] = v;
      }
      byKey.set(key, combined as T);
    }
  }
  return [...byKey.values()];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeInto(
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  path: string,
  kb: KnowledgeBase,
  sources: Record<string, FieldSource>,
) {
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null || value === "") continue;
    const fieldPath = path ? `${path}.${key}` : key;
    const current = target[key];

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      target[key] = dedupe([...((current as unknown[]) ?? []), ...value]);
      if (!kb.sources[fieldPath] && sources[fieldPath]) kb.sources[fieldPath] = sources[fieldPath];
    } else if (isPlainObject(value) && isPlainObject(current)) {
      // A source on a parent ("extras.compliance") covers its children.
      if (!kb.sources[fieldPath] && sources[fieldPath]) kb.sources[fieldPath] = sources[fieldPath];
      mergeInto(current, value, fieldPath, kb, sources);
    } else {
      const existing = kb.sources[fieldPath];
      const next = sources[fieldPath];
      const isEmpty = current === null || current === undefined || current === "";
      const isBetter =
        next && existing && CONFIDENCE_RANK[next.confidence] > CONFIDENCE_RANK[existing.confidence];
      if (isEmpty || isBetter) {
        target[key] = value;
        if (next) kb.sources[fieldPath] = next;
      }
    }
  }
}

/** Merges one ExtractorResult into the knowledge base in place. */
export function mergeResult(kb: KnowledgeBase, result: ExtractorResult): void {
  mergeInto(kb as unknown as Record<string, unknown>, result.data as Record<string, unknown>, "", kb, result.sources);
}
