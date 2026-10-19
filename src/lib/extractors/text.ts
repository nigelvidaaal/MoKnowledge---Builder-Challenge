// Small text helpers shared by the extractors.

import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export function clean(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function textOf($: CheerioAPI, el: Cheerio<AnyNode> | AnyNode): string {
  return clean($(el).text());
}

export function sentences(text: string): string[] {
  return text
    // Split on newlines first so a heading never joins the next paragraph.
    .split("\n")
    .flatMap((line) => line.match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g) ?? [])
    .map(clean)
    .filter((s) => s.length > 1);
}

export function blockText($: CheerioAPI, el: Cheerio<AnyNode> | AnyNode): string {
  const copy = $(el).clone();
  copy.find("p, div, li, br, h1, h2, h3, h4, h5, h6, dt, dd, span").after("\n");
  return copy
    .text()
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Normalizes US phone numbers to "(702) 555-0142"; leaves others alone. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : clean(raw);
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** "Maria Torres", "Doug Cohen", "Kelly A. Jones": 2–4 capitalized words. */
export function looksLikePersonName(s: string): boolean {
  const t = clean(s);
  if (t.length > 40 || /\d|@|[|:]/.test(t)) return false;
  const words = t.split(" ");
  if (words.length < 2 || words.length > 4) return false;
  const NOT_NAMES = /^(our|the|meet|about|contact|call|get|free|why|how|what|services?|team|home|read|learn|view|book|request)$/i;
  return words.every((w) => /^[A-Z][a-zA-Z'’.-]*$/.test(w) && !NOT_NAMES.test(w));
}

export function rankByFrequency(items: string[]): string[] {
  const counts = new Map<string, { value: string; n: number }>();
  for (const item of items) {
    const key = item.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.n++;
    else counts.set(key, { value: item, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.value);
}

export function mainContent($: CheerioAPI): Cheerio<AnyNode> {
  const main = $("main, [role=main], article, #content, .content").first();
  return main.length ? main : $("body");
}
