// The vertical section stepper in the review sidebar.

"use client";

import type { KnowledgeBase } from "@/types/knowledge";
import { SECTIONS, sectionStatus, type SectionState } from "@/lib/knowledge/sections";

/** A 18px circle: solid (full), bottom half filled (partial) or an outline (empty). */
export function StatusDot({ state }: { state: SectionState }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="relative z-[2] shrink-0">
      {state === "full" ? (
        <circle cx="9" cy="9" r="8" fill="var(--brand)" />
      ) : (
        <>
          <circle cx="9" cy="9" r="7.25" fill="white" stroke="var(--brand)" strokeWidth="1.5" />
          {/* Lower half: an arc from the left edge to the right edge through the bottom. */}
          {state === "partial" && <path d="M1.75 9 A7.25 7.25 0 0 0 16.25 9 Z" fill="var(--brand)" />}
        </>
      )}
    </svg>
  );
}

const STATE_TEXT: Record<SectionState, string> = { full: "complete", partial: "in progress", empty: "not started" };

export function SectionStepper({ kb, active, onSelect }: { kb: KnowledgeBase; active: string; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Sections">
      <ol>
        {SECTIONS.map((section, i) => {
          const status = sectionStatus(kb, section);
          const isActive = section.id === active;
          const isLast = i === SECTIONS.length - 1;
          const startsExtras = section.beyondBaseline && !SECTIONS[i - 1]?.beyondBaseline;
          return (
            <li key={section.id} className={`relative ${isLast ? "" : "pb-3"}`}>
              {/* The connecting line runs through every dot: from the previous row down to the next. */}
              <span
                className="pointer-events-none absolute left-[16px] z-[1] w-0.5 bg-[var(--brand)]/70"
                style={{ top: i === 0 ? 24 : 0, bottom: isLast ? 24 : 0 }}
                aria-hidden
              />
              {startsExtras && (
                <p className="mb-1 ml-9 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Beyond the baseline</p>
              )}
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                aria-current={isActive ? "step" : undefined}
                className={`relative flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors ${
                  isActive ? "bg-[var(--wash)]" : "hover:bg-slate-50"
                }`}
              >
                <StatusDot state={status.state} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${isActive ? "font-semibold text-[var(--brand)]" : "font-medium text-[var(--ink)]"}`}>
                    {section.title}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {status.filled} of {status.total} filled<span className="sr-only">, {STATE_TEXT[status.state]}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
        {(["full", "partial", "empty"] as SectionState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <StatusDot state={s} />
            {s === "full" ? "Complete" : s === "partial" ? "Missing info" : "Empty"}
          </span>
        ))}
      </div>
    </nav>
  );
}
