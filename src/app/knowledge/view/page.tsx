// /knowledge/view: the library of saved knowledge bases (cards, table, or list + detail).

"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { KnowledgeBase } from "@/types/knowledge";
import { knowledgeApi } from "@/lib/client/knowledgeApi";
import { completeness } from "@/lib/knowledge/completeness";
import { BrandIdentity } from "@/components/knowledge/BrandIdentity";
import { ItemActions } from "@/components/library/ItemActions";
import { KnowledgeDetail } from "@/components/library/KnowledgeDetail";

type ViewMode = "cards" | "table" | "detail";
type SortKey = "updated" | "name" | "completeness";
const VIEW_KEY = "moknowledge:view";

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Name, URL, industry, overview, locations and offerings joined into one lowercase string. */
function searchText(kb: KnowledgeBase): string {
  return [
    kb.foundation.name,
    kb.sourceUrl,
    kb.foundation.industry,
    kb.foundation.overview,
    ...kb.foundation.serviceLocations,
    ...kb.offerings.map((o) => o.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ScoreBadge({ kb }: { kb: KnowledgeBase }) {
  const { score } = completeness(kb);
  const tone = score >= 75 ? "bg-emerald-50 text-emerald-700" : score >= 50 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{score}% complete</span>;
}

function Library() {
  const router = useRouter();
  const params = useSearchParams();
  const [items, setItems] = useState<KnowledgeBase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<ViewMode>("cards");
  const selectedId = params.get("id");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (saved) setView(saved);
    } catch {
      /** storage unavailable: keep default */
    }
    knowledgeApi
      .list()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  function changeView(v: ViewMode) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /** ignore */
    }
  }

  async function remove(id: string) {
    try {
      await knowledgeApi.remove(id);
      setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
      if (selectedId === id) router.replace("/knowledge/view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  const industries = useMemo(
    () => [...new Set((items ?? []).map((k) => k.foundation.industry).filter((x): x is string => !!x))].sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter((k) => (industry === "all" ? true : k.foundation.industry === industry))
      .filter((k) => (q ? searchText(k).includes(q) : true))
      .sort((a, b) => {
        if (sort === "name") return (a.foundation.name ?? "").localeCompare(b.foundation.name ?? "");
        if (sort === "completeness") return completeness(b).score - completeness(a).score;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [items, query, industry, sort]);

  const selected = visible.find((k) => k.id === selectedId) ?? visible[0];
  const control =
    "rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge library</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {items ? `${items.length} saved ${items.length === 1 ? "company" : "companies"}` : "Loading…"}
          </p>
        </div>
        <Link href="/knowledge" className="self-start rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-ink)] sm:self-auto">
          Build a new one
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">
          {error}
        </p>
      )}

      {items && items.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex-1">
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, website, industry, service or location"
              className={`${control} w-full`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label>
              <span className="sr-only">Industry</span>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={control}>
                <option value="all">All industries</option>
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={control}>
                <option value="updated">Recently updated</option>
                <option value="name">Name A–Z</option>
                <option value="completeness">Most complete</option>
              </select>
            </label>
            <div className="inline-flex rounded-lg border border-[var(--line)] bg-white p-0.5" role="group" aria-label="View">
              {(["cards", "table", "detail"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => changeView(v)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                    view === v ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {v === "detail" ? "Details" : v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty states */}
      {items && items.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center">
          <p className="font-medium">No knowledge bases yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Scrape a company website and save it to see it here.</p>
          <Link href="/knowledge" className="mt-4 inline-block rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white">
            Build your first one
          </Link>
        </div>
      )}
      {items && items.length > 0 && visible.length === 0 && (
        <p className="mt-10 text-center text-sm text-[var(--muted)]">No matches. Try a different search or industry.</p>
      )}

      {/* Cards */}
      {view === "cards" && visible.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((kb) => (
            <li key={kb.id} className="flex flex-col rounded-2xl border border-[var(--line)] bg-white p-5">
              <BrandIdentity kb={kb} size="sm" />
              <p className="mt-3 line-clamp-3 text-sm text-[var(--muted)]">{kb.foundation.overview ?? "No overview yet."}</p>
              <div className="mb-4 mt-3 flex flex-wrap gap-1.5 text-xs">
                {kb.foundation.industry && <span className="rounded-full bg-[var(--wash)] px-2 py-0.5">{kb.foundation.industry}</span>}
                <span className="rounded-full bg-[var(--wash)] px-2 py-0.5">{kb.offerings.length} {kb.offerings.length === 1 ? "offering" : "offerings"}</span>
                <ScoreBadge kb={kb} />
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    changeView("detail");
                    router.replace(`/knowledge/view?id=${kb.id}`);
                  }}
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  View details
                </button>
                <ItemActions kb={kb} onDelete={remove} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Table */}
      {view === "table" && visible.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--wash)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Industry</th>
                <th className="px-4 py-3 font-medium">Locations</th>
                <th className="px-4 py-3 font-medium">Offerings</th>
                <th className="px-4 py-3 font-medium">Completeness</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((kb) => (
                <tr key={kb.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        changeView("detail");
                        router.replace(`/knowledge/view?id=${kb.id}`);
                      }}
                      className="text-left font-medium hover:text-[var(--brand)]"
                    >
                      {kb.foundation.name ?? domainOf(kb.sourceUrl)}
                    </button>
                    <p className="text-xs text-[var(--muted)]">{domainOf(kb.sourceUrl)}</p>
                  </td>
                  <td className="px-4 py-3">{kb.foundation.industry ?? "—"}</td>
                  <td className="px-4 py-3">{kb.foundation.serviceLocations.slice(0, 2).join(", ") || "—"}</td>
                  <td className="px-4 py-3">{kb.offerings.length}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge kb={kb} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(kb.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <ItemActions kb={kb} onDelete={remove} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* List + detail */}
      {view === "detail" && visible.length > 0 && selected && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <ul className="space-y-1 lg:sticky lg:top-20 lg:self-start" aria-label="Companies">
            {visible.map((kb) => (
              <li key={kb.id}>
                <button
                  type="button"
                  aria-current={kb.id === selected.id ? "true" : undefined}
                  onClick={() => router.replace(`/knowledge/view?id=${kb.id}`)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                    kb.id === selected.id ? "border-[var(--brand)] bg-white" : "border-transparent hover:bg-white"
                  }`}
                >
                  <p className="truncate text-sm font-medium">{kb.foundation.name ?? domainOf(kb.sourceUrl)}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{domainOf(kb.sourceUrl)}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <ScoreBadge kb={selected} /> Updated {formatDate(selected.updatedAt)}
              </div>
              <ItemActions kb={selected} onDelete={remove} />
            </div>
            <KnowledgeDetail kb={selected} />
          </div>
        </div>
      )}
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <Library />
    </Suspense>
  );
}
