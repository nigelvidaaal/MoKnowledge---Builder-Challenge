// One section of the knowledge base as a MoFlo-style card.

"use client";

import type { KnowledgeBase } from "@/types/knowledge";
import { AI_FILLABLE } from "@/lib/ai/mockEnhance";
import { getPath } from "@/lib/knowledge/path";
import { sectionStatus, type SectionDef } from "@/lib/knowledge/sections";
import { Icon } from "@/components/ui/Icon";
import { FieldEditor } from "./fields";

interface Props {
  section: SectionDef;
  kb: KnowledgeBase;
  busy: boolean;
  onFillWithAi: (section: SectionDef, paths: string[]) => void;
  onRebuildStarters: () => void;
  prev?: SectionDef;
  next?: SectionDef;
  onNavigate: (id: string) => void;
}

export function SectionCard({ section, kb, busy, onFillWithAi, onRebuildStarters, prev, next, onNavigate }: Props) {
  const status = sectionStatus(kb, section);
  const onlyRecords = section.fields.length === 1 && section.fields[0].kind === "records";
  const count = onlyRecords ? ((getPath(kb, section.fields[0].path) as unknown[]) ?? []).length : null;

  // AI never invents people, reviews or links, so only some fields are fillable.
  const aiPaths = section.fields.map((f) => f.path).filter((p) => AI_FILLABLE.includes(p));
  const noteId = `${section.id}-ai-note`;
  // The Content starters section is rebuilt by rules from the other sections, not AI-filled.
  const isStarters = section.id === "starters";

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">
              {section.title}
            </h2>
            <span className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-xs font-semibold text-[var(--brand)]">
              {count !== null ? count : `${status.filled}/${status.total}`}
            </span>
            {section.beyondBaseline && (
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">Beyond baseline</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{section.description}</p>
          {aiPaths.length === 0 && !isStarters && (
            <p id={noteId} className="mt-1 text-xs text-[var(--muted)]">
              AI fill isn&apos;t offered here: it won&apos;t invent people, products, reviews, links or legal text.
            </p>
          )}
        </div>
        {isStarters ? (
          <button
            type="button"
            onClick={onRebuildStarters}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:opacity-60"
          >
            <Icon name="sparkle" />
            Rebuild from facts
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onFillWithAi(section, aiPaths)}
            disabled={busy || aiPaths.length === 0}
            aria-describedby={aiPaths.length === 0 ? noteId : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-white disabled:text-slate-400 disabled:shadow-none"
          >
            <Icon name="sparkle" />
            Fill this section with AI
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {section.fields.map((f) => (
          <FieldEditor key={f.path} field={f} hideLabel={onlyRecords} />
        ))}
      </div>

      <div className="mt-7 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
        {prev ? (
          <button type="button" onClick={() => onNavigate(prev.id)} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--brand)]">
            <Icon name="chevronLeft" />
            {prev.title}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            onClick={() => onNavigate(next.id)}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] px-3.5 py-2 text-sm font-semibold text-[var(--ink)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            Next: {next.title}
            <Icon name="chevronRight" />
          </button>
        )}
      </div>
    </section>
  );
}
