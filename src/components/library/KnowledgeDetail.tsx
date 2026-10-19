// Read-only view of one knowledge base, built from the same section config as the editor.

import type { KnowledgeBase } from "@/types/knowledge";
import { getPath } from "@/lib/knowledge/path";
import { SECTIONS, type FieldDef } from "@/lib/knowledge/sections";
import { SourceTag } from "@/components/knowledge/SourceTag";
import { BrandIdentity } from "@/components/knowledge/BrandIdentity";

function sourceOf(kb: KnowledgeBase, path: string) {
  const parts = path.split(".");
  while (parts.length) {
    const s = kb.sources[parts.join(".")];
    if (s) return s;
    parts.pop();
  }
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function Value({ field, value }: { field: FieldDef; value: unknown }) {
  if (field.kind === "colors") {
    return (
      <div className="flex flex-wrap gap-2">
        {(value as string[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-1.5 py-0.5 font-mono text-xs">
            <span className="h-3.5 w-3.5 rounded" style={{ background: c }} />
            {c}
          </span>
        ))}
      </div>
    );
  }
  if (field.kind === "images") {
    return (
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(value as { url: string; alt: string | null; category: string }[]).map((img) => (
          <li key={img.url} className="overflow-hidden rounded-lg bg-[var(--wash)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? `${img.category} photo`} loading="lazy" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
          </li>
        ))}
      </ul>
    );
  }
  if (field.kind === "list") {
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {(value as string[]).map((v, i) => (
          <li key={`${v}-${i}`}>{/^https?:\/\//.test(v) ? <a className="break-all text-[var(--brand)] hover:underline" href={v} target="_blank" rel="noreferrer">{v}</a> : v}</li>
        ))}
      </ul>
    );
  }
  if (field.kind === "records") {
    const cols = field.columns ?? [];
    return (
      <div className="space-y-2">
        {(value as Record<string, unknown>[]).map((item, i) => (
          <div key={i} className="rounded-lg bg-[var(--wash)] p-3 text-sm">
            {cols.map((c) =>
              isEmpty(item[c.key]) ? null : c.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c.key} src={String(item[c.key])} alt={`${String(item.name ?? "")} photo`} className="mb-2 h-14 w-14 rounded-full object-cover" />
              ) : (
                <p key={c.key} className="mt-0.5 first:mt-0">
                  <span className="text-[var(--muted)]">{c.label}: </span>
                  {Array.isArray(item[c.key]) ? (item[c.key] as string[]).join(" · ") : String(item[c.key])}
                </p>
              ),
            )}
          </div>
        ))}
      </div>
    );
  }
  return <p className="whitespace-pre-line text-sm leading-relaxed">{String(value)}</p>;
}

export function KnowledgeDetail({ kb }: { kb: KnowledgeBase }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
        <BrandIdentity kb={kb} />
      </div>
      {SECTIONS.map((section) => {
        const filled = section.fields.filter((f) => !isEmpty(getPath(kb, f.path)));
        if (!filled.length) return null;
        return (
          <section key={section.id} className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <h3 className="font-semibold">{section.title}</h3>
            <dl className="mt-3 space-y-4">
              {filled.map((f) => (
                <div key={f.path}>
                  <dt className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
                    {f.label} <SourceTag source={sourceOf(kb, f.path)} />
                  </dt>
                  <dd>
                    <Value field={f} value={getPath(kb, f.path)} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
