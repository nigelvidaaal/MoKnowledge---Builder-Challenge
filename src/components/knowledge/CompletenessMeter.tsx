// The circular completeness score and chips for the MAJOR missing fields only.

import type { Completeness } from "@/lib/knowledge/completeness";

export function CompletenessMeter({ value, onSelect }: { value: Completeness; onSelect?: (sectionId: string) => void }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const tone = value.score >= 75 ? "#16a34a" : value.score >= 50 ? "#d97706" : "#e11d48";
  // Only the major fields are listed; the section stepper shows everything else.
  const major = value.missing.filter((m) => m.major);
  const minorCount = value.missing.length - major.length;

  return (
    <div>
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${value.score}% complete`}>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value.score / 100)}
            transform="rotate(-90 32 32)"
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
          <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--ink)">
            {value.score}%
          </text>
        </svg>
        <div>
          <p className="font-semibold">Knowledge completeness</p>
          <p className="text-sm text-[var(--muted)]">
            {major.length
              ? `${major.length} key ${major.length === 1 ? "field" : "fields"} to fill`
              : minorCount
                ? "All key fields filled"
                : "Everything is filled"}
          </p>
        </div>
      </div>
      {major.length > 0 && (
        <>
          <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Matters most for content</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {major.map((m) => (
              <li key={m.label}>
                <button
                  type="button"
                  onClick={() => onSelect?.(m.section)}
                  className="rounded-md bg-[var(--wash)] px-2 py-0.5 text-xs font-medium text-[var(--ink)] hover:text-[var(--brand)]"
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {minorCount > 0 && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          +{minorCount} smaller {minorCount === 1 ? "detail" : "details"}, shown in the sections list.
        </p>
      )}
    </div>
  );
}
