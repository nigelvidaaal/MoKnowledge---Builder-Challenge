// Rules every enrichment prompt shares.

export const GROUNDING_RULES = `
Rules:
1. Use ONLY the information inside <scraped_data>. Do not use outside knowledge about this company.
2. If the data does not support a field, return null for it. Never guess names, numbers, dates, prices, or locations.
3. For every field you fill, add an entry to "evidence" quoting the exact phrase(s) you relied on and the page URL.
4. Write for a small-business owner who will review this. Plain, specific language. No hype words like "revolutionary", "cutting-edge", or "world-class" unless the company uses them itself.
5. Return valid JSON only, matching the schema exactly. No commentary before or after.
`.trim();

/** Wraps scraped content so instructions and data are clearly separated. */
export function scrapedBlock(data: unknown): string {
  return `<scraped_data>\n${JSON.stringify(data, null, 2)}\n</scraped_data>`;
}
