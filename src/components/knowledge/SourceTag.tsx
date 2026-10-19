// The colored badge showing where a value came from, plus the legend of all badges.

import type { FieldSource, SourceMethod } from "@/types/knowledge";

const LABELS: Record<SourceMethod, { text: string; className: string; explain: string }> = {
  "json-ld": { text: "Structured data", className: "bg-blue-50 text-blue-700 ring-blue-200", explain: "Published by the site as schema.org data" },
  meta: { text: "Meta tags", className: "bg-sky-50 text-sky-700 ring-sky-200", explain: "From the page's meta / Open Graph tags" },
  html: { text: "Page content", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", explain: "Read from the page's links, headings and text" },
  pattern: { text: "Pattern", className: "bg-amber-50 text-amber-800 ring-amber-200", explain: "Matched a text pattern. Worth a quick check" },
  css: { text: "Stylesheet", className: "bg-violet-50 text-violet-700 ring-violet-200", explain: "Measured from the site's CSS" },
  derived: { text: "Built from facts", className: "bg-indigo-50 text-indigo-700 ring-indigo-200", explain: "Assembled by rules from other fields on this page. No AI involved" },
  ai_mock: { text: "AI mock", className: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-300", explain: "Placeholder for LLM output. Not real AI. Review before use" },
  user: { text: "Edited by you", className: "bg-slate-100 text-slate-700 ring-slate-300", explain: "Entered or confirmed by a person" },
};

const CONFIDENCE_DOT: Record<FieldSource["confidence"], string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-rose-400",
};

export function SourceTag({ source }: { source?: FieldSource }) {
  if (!source) {
    return <span className="text-xs text-[var(--muted)]">Not found</span>;
  }
  const label = LABELS[source.method];
  const title = `${label.explain}. Confidence: ${source.confidence}.${source.url ? `\nFound on ${source.url}` : ""}`;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${label.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[source.confidence]}`} aria-hidden />
      {label.text}
      <span className="sr-only">, {source.confidence} confidence</span>
    </span>
  );
}

export function SourceLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(LABELS) as SourceMethod[]).map((m) => (
        <SourceTag key={m} source={{ method: m, confidence: m === "ai_mock" ? "low" : m === "pattern" ? "medium" : "high" }} />
      ))}
    </div>
  );
}
