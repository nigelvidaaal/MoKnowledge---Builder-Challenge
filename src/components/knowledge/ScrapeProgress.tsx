// Shows each step the server reports while scraping, with the current one active.

/** role=status + aria-live announces each step to screen readers. */
export function ScrapeProgress({ steps, url }: { steps: string[]; url: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-6" role="status" aria-live="polite">
      <p className="text-sm text-[var(--muted)]">
        Reading <span className="font-medium text-[var(--ink)]">{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
      </p>
      <ol className="mt-4 space-y-2.5">
        {steps.map((step, i) => {
          const current = i === steps.length - 1;
          return (
            <li key={`${step}-${i}`} className="flex items-center gap-3 text-sm">
              {current ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" aria-hidden />
              ) : (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] text-white" aria-hidden>
                  ✓
                </span>
              )}
              <span className={current ? "font-medium text-[var(--ink)]" : "text-[var(--muted)]"}>{step}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 text-xs text-[var(--muted)]">Most sites take 10 to 30 seconds. We read up to 12 pages and respect robots.txt.</p>
    </div>
  );
}
