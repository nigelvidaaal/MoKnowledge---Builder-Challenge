// The review screen, laid out like MoFlo Cloud.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { completeness } from "@/lib/knowledge/completeness";
import { buildContentStarters, DERIVED } from "@/lib/knowledge/derive";
import { SECTIONS, type SectionDef } from "@/lib/knowledge/sections";
import { downloadJson, knowledgeApi, type EnhancePrompt } from "@/lib/client/knowledgeApi";
import { Icon } from "@/components/ui/Icon";
import { BrandIdentity } from "./BrandIdentity";
import { CompletenessMeter } from "./CompletenessMeter";
import { useKnowledgeEditor } from "./KnowledgeEditorContext";
import { PromptsPanel } from "./PromptsPanel";
import { SectionCard } from "./SectionCard";
import { SectionStepper } from "./SectionStepper";
import { SourceLegend } from "./SourceTag";

interface Props {
  warnings: string[];
  persisted: boolean;
  onSaved: (id: string) => void;
}

type Status = { kind: "idle" } | { kind: "busy"; label: string } | { kind: "ok"; message: string } | { kind: "error"; message: string };

export function KnowledgeWorkspace({ warnings, persisted, onSaved }: Props) {
  const { knowledge, dirty, load, set } = useKnowledgeEditor();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [ai, setAi] = useState<{ prompts: EnhancePrompt[]; filled: string[] } | null>(null);
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const mainRef = useRef<HTMLDivElement>(null);
  const score = useMemo(() => (knowledge ? completeness(knowledge) : null), [knowledge]);

  /** Warn before closing the tab with unsaved changes. */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (!knowledge || !score) return null;

  const index = Math.max(0, SECTIONS.findIndex((s) => s.id === activeId));
  const active = SECTIONS[index];

  function openSection(id: string) {
    setActiveId(id);
    const top = mainRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Mock AI fill: all gaps, or only `paths` for one section. */
  async function enhance(paths?: string[], label?: string) {
    setStatus({ kind: "busy", label: label ? `Filling ${label}…` : "Filling gaps…" });
    try {
      const res = await knowledgeApi.enhance(knowledge!, paths);
      load(res.knowledge, { dirty: dirty || res.filled.length > 0 });
      setAi({ prompts: res.prompts, filled: res.filled });
      setStatus({
        kind: "ok",
        message: res.filled.length
          ? `Filled ${res.filled.length} field${res.filled.length === 1 ? "" : "s"}${label ? ` in ${label}` : ""} with AI mock placeholders. Review before saving.`
          : label
            ? `Nothing empty in ${label} for AI to fill.`
            : "No empty AI fields to fill.",
      });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't fill gaps." });
    }
  }

  const fillSection = (section: SectionDef, paths: string[]) => enhance(paths, section.title);

  /** Rebuild content starters from the current facts (asks first if you edited them). */
  function rebuildStarters() {
    const edited = knowledge!.sources["extras.contentStarters"]?.method === "user";
    if (edited && !window.confirm("Replace your edited ideas with freshly built ones?")) return;
    const starters = buildContentStarters(knowledge!);
    set("extras.contentStarters", starters, DERIVED);
    setStatus({
      kind: "ok",
      message: starters.length
        ? `Built ${starters.length} content ideas from the current facts.`
        : "Not enough facts yet. Add offerings, FAQs or testimonials first.",
    });
  }

  async function save() {
    setStatus({ kind: "busy", label: "Saving…" });
    try {
      const saved = persisted ? await knowledgeApi.update(knowledge!) : await knowledgeApi.create(knowledge!);
      load(saved);
      onSaved(saved.id);
      setStatus({ kind: "ok", message: "Saved to your library." });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Couldn't save." });
    }
  }

  const busy = status.kind === "busy";

  return (
    <div className="space-y-5">
      {/* ---------- Top bar: company and actions ---------- */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <BrandIdentity kb={knowledge} size="sm" />
          <span className="hidden text-xs text-[var(--muted)] sm:inline">
            Read {knowledge.scrapedPages.length} page{knowledge.scrapedPages.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadJson(knowledge)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[var(--wash)]"
          >
            <Icon name="download" />
            JSON
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || (persisted && !dirty)}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {persisted ? (dirty ? "Save changes" : "All changes saved") : "Save to library"}
          </button>
        </div>
      </div>

      {/* Source tag legend: always visible so every tag on the page is self-explanatory. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
          <Icon name="info" className="h-4 w-4 text-[var(--brand)]" />
          Where each value came from
        </p>
        <SourceLegend />
        <p className="text-xs text-[var(--muted)] lg:ml-auto lg:max-w-56 lg:text-right">Hover a tag for the page and confidence. Your edits show as “Edited by you”.</p>
      </div>

      {/* Status of the last action (save / AI fill). */}
      <p className={status.kind === "idle" ? "sr-only" : "px-1 text-sm"} role="status" aria-live="polite">
        {status.kind === "busy" && <span className="text-[var(--muted)]">{status.label}</span>}
        {status.kind === "ok" && (
          <span className="text-emerald-700">
            {status.message}{" "}
            {status.message.startsWith("Saved") && (
              <Link href="/knowledge/view" className="underline">
                Open library
              </Link>
            )}
          </span>
        )}
        {status.kind === "error" && <span className="text-rose-700">{status.message}</span>}
      </p>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-[var(--brand)]/25 bg-[#eef3fe] p-4 text-sm text-[#1d3f9e]">
          <p className="flex items-center gap-1.5 font-semibold text-[var(--brand-ink)]">
            <Icon name="info" className="h-4 w-4" />
            Heads up
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ---------- Main: the open section ---------- */}
        <div ref={mainRef} className="min-w-0 scroll-mt-20 space-y-5">
          {/* Phones and tablets: the sidebar stepper sits below the section, so offer a quick
              switcher here. Hidden on desktop, where the stepper is always visible. */}
          <div className="lg:hidden">
            <label htmlFor="section-switcher" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Section
            </label>
            <div className="relative">
              <select
                id="section-switcher"
                value={active.id}
                onChange={(e) => openSection(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[var(--line)] bg-white py-2.5 pl-3.5 pr-9 text-sm font-semibold text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
              >
                {SECTIONS.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.title}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand)]">
                <Icon name="chevronDown" />
              </span>
            </div>
          </div>
          <SectionCard
            section={active}
            kb={knowledge}
            busy={busy}
            onFillWithAi={fillSection}
            onRebuildStarters={rebuildStarters}
            prev={SECTIONS[index - 1]}
            next={SECTIONS[index + 1]}
            onNavigate={openSection}
          />
          {ai && ai.prompts.length > 0 && <PromptsPanel prompts={ai.prompts} filled={ai.filled} />}
        </div>

        {/* ---------- Right sidebar ---------- */}
        <aside className="space-y-4 lg:self-start">

          <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <CompletenessMeter value={score} onSelect={openSection} />
            <button
              type="button"
              onClick={() => enhance()}
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)] disabled:opacity-60"
            >
              <Icon name="sparkle" />
              Fill all gaps with AI (mock)
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="mb-3 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Sections</p>
            <SectionStepper kb={knowledge} active={active.id} onSelect={openSection} />
          </div>

        </aside>
      </div>
    </div>
  );
}
