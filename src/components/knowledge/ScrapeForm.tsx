// The URL input and submit button.

"use client";

import { useState } from "react";
import { validateUrl } from "@/lib/scraper/validateUrl";

interface Props {
  busy: boolean;
  initialUrl?: string;
  compact?: boolean;
  onSubmit: (url: string) => void;
}

export function ScrapeForm({ busy, initialUrl = "", compact = false, onSubmit }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateUrl(url);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    onSubmit(check.url);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <label htmlFor="site-url" className={compact ? "sr-only" : "mb-3 block text-base font-semibold text-[var(--ink)]"}>
        Company website
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="site-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          placeholder="beecavedrilling.com"
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={error ? "site-url-error" : undefined}
          className={`flex-1 rounded-xl border bg-white px-4 text-[var(--ink)] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[var(--brand)]/15 disabled:bg-slate-50 ${
            compact ? "py-2 text-sm" : "py-4 text-lg"
          } ${error ? "border-rose-400" : "border-[var(--line)] focus:border-[var(--brand)]"}`}
        />
        <button
          type="submit"
          disabled={busy}
          className={`whitespace-nowrap rounded-xl bg-[var(--brand)] font-semibold text-white hover:bg-[var(--brand-ink)] disabled:cursor-wait disabled:opacity-60 ${
            compact ? "px-4 py-2 text-sm" : "px-8 py-4 text-lg"
          }`}
        >
          {busy ? "Reading site…" : compact ? "Scrape again" : "Build knowledge base"}
        </button>
      </div>
      {error && (
        <p id="site-url-error" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </form>
  );
}
