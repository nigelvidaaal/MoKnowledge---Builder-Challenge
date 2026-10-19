// /knowledge: enter a URL, watch the scrape, review and save.
// ?id=<id> opens a saved one; ?url=<url> starts a scrape.

"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KnowledgeEditorProvider, useKnowledgeEditor } from "@/components/knowledge/KnowledgeEditorContext";
import { KnowledgeWorkspace } from "@/components/knowledge/KnowledgeWorkspace";
import { ScrapeForm } from "@/components/knowledge/ScrapeForm";
import { ScrapeProgress } from "@/components/knowledge/ScrapeProgress";
import { knowledgeApi } from "@/lib/client/knowledgeApi";
import { runScrape } from "@/lib/client/scrapeClient";
import { HOME_EVENT } from "@/lib/client/events";

type Phase =
  | { kind: "empty" }
  | { kind: "scraping"; url: string; steps: string[] }
  | { kind: "loading" }
  | { kind: "ready"; warnings: string[]; persisted: boolean }
  | { kind: "error"; message: string };

function BuildPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { knowledge, dirty, load, reset } = useKnowledgeEditor();
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });
  const started = useRef<string | null>(null);

  const scrape = useCallback(
    async (url: string) => {
      setPhase({ kind: "scraping", url, steps: ["Starting"] });
      try {
        const { knowledge: kb, warnings } = await runScrape(url, (m) =>
          setPhase((p) => (p.kind === "scraping" ? { ...p, steps: [...p.steps, m] } : p)),
        );
        load(kb);
        setPhase({ kind: "ready", warnings, persisted: false });
        router.replace("/knowledge");
      } catch (err) {
        setPhase({ kind: "error", message: err instanceof Error ? err.message : "Scrape failed." });
      }
    },
    [load, router],
  );

  // Open a saved knowledge base, or start a scrape from the URL, once per param.
  useEffect(() => {
    const id = params.get("id");
    const url = params.get("url");
    const key = id ? `id:${id}` : url ? `url:${url}` : null;
    if (!key || started.current === key) return;
    started.current = key;

    if (id) {
      setPhase({ kind: "loading" });
      knowledgeApi
        .get(id)
        .then((kb) => {
          load(kb);
          setPhase({ kind: "ready", warnings: [], persisted: true });
        })
        .catch((err) => setPhase({ kind: "error", message: err.message }));
    } else if (url) {
      void scrape(url);
    }
  }, [params, load, scrape]);

  useEffect(() => {
    const goHome = () => {
      if (dirty && !window.confirm("Discard your unsaved changes and start over?")) return;
      reset();
      started.current = null;
      setPhase({ kind: "empty" });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener(HOME_EVENT, goHome);
    return () => window.removeEventListener(HOME_EVENT, goHome);
  }, [dirty, reset]);

  const busy = phase.kind === "scraping" || phase.kind === "loading";
  const hasResult = phase.kind === "ready" && knowledge;

  /** <html data-hero> turns the header MoFlo blue on the start screen. */
  useEffect(() => {
    const root = document.documentElement;
    if (!hasResult) root.dataset.hero = "true";
    else delete root.dataset.hero;
    return () => {
      delete root.dataset.hero;
    };
  }, [hasResult]);

  // Start screen: hero fading from MoFlo blue to the page background.
  if (!hasResult) {
    return (
      <main>
        <section
          className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-28 pt-16 sm:px-6 sm:pt-24"
          style={{
            background: "linear-gradient(180deg, #2663eb 0%, #2663eb 28%, #6f9cf3 55%, #dbe6fd 78%, var(--page) 100%)",
          }}
        >
          {/* Faint grid texture near the top, fading out downward (decorative). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "linear-gradient(180deg, black 0%, transparent 55%)",
              WebkitMaskImage: "linear-gradient(180deg, black 0%, transparent 55%)",
            }}
          />
          {/* Soft light behind the headline (decorative). */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-white/15 blur-3xl" />

          <div className="mx-auto max-w-5xl text-center">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/25">
              Knowledge for MoSocial · MoMail · MoBlogs
            </p>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">Learn a business from its website</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90 sm:text-xl">
              Paste a company&apos;s website. MoKnowledge reads its key pages and builds a knowledge base you can review, edit, and save.
            </p>

            <div className="mx-auto mt-12 max-w-3xl rounded-3xl bg-white p-5 text-left shadow-[0_30px_70px_-28px_rgba(15,40,120,0.6)] ring-1 ring-white/60 sm:p-7">
              <ScrapeForm busy={busy} onSubmit={scrape} />
            </div>

            <div className="mx-auto mt-6 max-w-3xl text-left">
              {phase.kind === "scraping" && <ScrapeProgress steps={phase.steps} url={phase.url} />}
              {phase.kind === "loading" && <p className="text-center text-sm text-[var(--muted)]">Opening knowledge base…</p>}
              {phase.kind === "error" && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
                  <p className="font-medium">We couldn&apos;t build this one</p>
                  <p className="mt-1">{phase.message}</p>
                  <p className="mt-2 text-rose-700">Check the address, or try the site&apos;s homepage. Some sites block automated readers.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Review knowledge base</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Check what was found, fix anything wrong, then save.</p>
          </div>
          <div className="w-full sm:w-[420px]">
            <ScrapeForm busy={busy} compact initialUrl={knowledge.sourceUrl} onSubmit={scrape} />
          </div>
        </div>
        <KnowledgeWorkspace
          warnings={phase.warnings}
          persisted={phase.persisted}
          onSaved={(id) => {
            setPhase((p) => (p.kind === "ready" ? { ...p, persisted: true } : p));
            started.current = `id:${id}`;
            router.replace(`/knowledge?id=${id}`);
          }}
        />
      </>
    </main>
  );
}

export default function KnowledgePage() {
  return (
    <KnowledgeEditorProvider>
      <Suspense fallback={null}>
        <BuildPage />
      </Suspense>
    </KnowledgeEditorProvider>
  );
}
