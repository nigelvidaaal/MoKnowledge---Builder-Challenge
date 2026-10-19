// Editors for every field kind, styled like MoFlo Cloud's field cards.

"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { BrandImage, FieldSource } from "@/types/knowledge";
import type { FieldDef, RecordColumn } from "@/lib/knowledge/sections";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PhotoInput } from "@/components/ui/PhotoInput";
import { useKnowledgeEditor } from "./KnowledgeEditorContext";
import { SourceTag } from "./SourceTag";

const bareInput =
  "w-full bg-transparent p-0 text-[15px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--brand)]/80 focus:outline-none focus-visible:outline-none";

const isEmptyValue = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Field card: uppercase label, source tag, pencil icon, then the control. */
export function FieldCard({
  htmlFor,
  label,
  source,
  wide,
  children,
}: {
  htmlFor?: string;
  label: string;
  source?: FieldSource | "none";
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`group rounded-xl border border-[var(--line)] bg-white px-4 py-3 transition-colors hover:border-slate-300 focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {source !== undefined && <SourceTag source={source === "none" ? undefined : source} />}
          <span className="text-slate-300 transition-colors group-hover:text-slate-500 group-focus-within:text-[var(--brand)]">
            <Icon name="pencil" />
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

export function FieldEditor({ field, hideLabel = false }: { field: FieldDef; hideLabel?: boolean }) {
  const { get, set, sourceOf } = useKnowledgeEditor();
  const value = get(field.path);
  const id = `f-${field.path.replace(/\./g, "-")}`;

  if (field.kind === "records") {
    return (
      <div className="sm:col-span-2">
        <RecordsEditor
          field={field}
          hideLabel={hideLabel}
          source={isEmptyValue(value) ? undefined : sourceOf(field.path)}
          items={(value as Record<string, unknown>[]) ?? []}
          onChange={(v) => set(field.path, v)}
        />
      </div>
    );
  }

  const wide = field.kind !== "text" && field.kind !== "number";
  return (
    <FieldCard htmlFor={id} label={field.label} source={isEmptyValue(value) ? "none" : sourceOf(field.path)} wide={wide}>
      {field.help && <p className="mb-1.5 text-xs text-[var(--muted)]">{field.help}</p>}
      <Control id={id} field={field} value={value} />
    </FieldCard>
  );
}

function Control({ id, field, value }: { id: string; field: FieldDef; value: unknown }) {
  const { set } = useKnowledgeEditor();
  const addLabel = `+ add ${field.label.toLowerCase()}`;
  switch (field.kind) {
    case "text":
      return (
        <input
          id={id}
          className={bareInput}
          value={(value as string) ?? ""}
          placeholder={field.placeholder ?? addLabel}
          onChange={(e) => set(field.path, e.target.value || null)}
        />
      );
    case "number":
      return (
        <input
          id={id}
          type="number"
          className={bareInput}
          value={(value as number) ?? ""}
          placeholder={addLabel}
          onChange={(e) => set(field.path, e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "textarea":
      return <AutoTextarea id={id} minRows={field.rows} value={(value as string) ?? ""} placeholder={addLabel} onChange={(v) => set(field.path, v || null)} />;
    case "list":
      return <ListEditor id={id} items={(value as string[]) ?? []} onChange={(v) => set(field.path, v)} addLabel={addLabel} />;
    case "colors":
      return <ColorEditor id={id} colors={(value as string[]) ?? []} onChange={(v) => set(field.path, v)} />;
    case "images":
      return <ImagesEditor id={id} images={(value as BrandImage[]) ?? []} onChange={(v) => set(field.path, v)} />;
    default:
      return null;
  }
}

/** Textarea that grows with its content (measured via scrollHeight). */
function AutoTextarea({
  id,
  value,
  placeholder,
  minRows = 1,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  minRows?: number;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Re-measure when the card changes width (window resize, sidebar wrapping).
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={minRows}
      className={`${bareInput} resize-none overflow-hidden`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ListEditor({
  id,
  items,
  onChange,
  addLabel = "+ add",
}: {
  id: string;
  items: string[];
  onChange: (v: string[]) => void;
  addLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };
  const long = items.some((i) => i.length > 60);

  return (
    <div>
      {items.length > 0 && (
        <ul className={long ? "mb-2 space-y-1.5" : "mb-2 flex flex-wrap gap-1.5"}>
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className={`flex gap-2 rounded-lg bg-[var(--wash)] px-2.5 py-1 text-sm text-[var(--ink)] ${long ? "items-start" : "items-center"}`}
            >
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-rose-600 focus-visible:text-rose-600"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={items.length ? "+ add another (press Enter)" : addLabel}
        className={`${bareInput} text-sm`}
      />
    </div>
  );
}

function ColorEditor({ id, colors, onChange }: { id: string; colors: string[]; onChange: (v: string[]) => void }) {
  // null = picker closed, "new" = adding a color, a number = editing that color.
  const [editing, setEditing] = useState<number | "new" | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className={`flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2 ${editing === i ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15" : "border-[var(--line)]"}`}
          >
            <button
              type="button"
              onClick={() => setEditing(editing === i ? null : i)}
              className="flex items-center gap-2"
              aria-label={`Edit color ${c}`}
              aria-expanded={editing === i}
            >
              <span className="h-7 w-7 rounded-md border border-black/10" style={{ background: c }} />
              <span className="font-mono text-xs uppercase text-[var(--ink)]">{c}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(colors.filter((_, j) => j !== i));
                setEditing(null);
              }}
              className="text-slate-400 hover:text-rose-600"
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          id={id}
          type="button"
          onClick={() => setEditing(editing === "new" ? null : "new")}
          aria-expanded={editing === "new"}
          className="px-1 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          + add color
        </button>
      </div>

      {editing !== null && (
        <div className="mt-3">
          <ColorPicker
            key={String(editing)}
            initial={editing === "new" ? "#2663eb" : colors[editing]}
            confirmLabel={editing === "new" ? "Add color" : "Save color"}
            onCancel={() => setEditing(null)}
            onConfirm={(hex) => {
              if (editing === "new") {
                if (!colors.includes(hex)) onChange([...colors, hex]);
              } else {
                onChange(colors.map((x, j) => (j === editing ? hex : x)));
              }
              setEditing(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ImagesEditor({ id, images, onChange }: { id: string; images: BrandImage[]; onChange: (v: BrandImage[]) => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) throw new Error();
      if (!images.some((img) => img.url === url.toString())) {
        onChange([...images, { url: url.toString(), alt: null, category: "Added by you", page: null }]);
      }
      setDraft("");
      setError(null);
    } catch {
      setError("Paste a full image link starting with https://");
    }
  };

  return (
    <div>
      {images.length > 0 && (
        <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <li key={img.url} className="group/img relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--wash)]">
              {broken.has(img.url) ? (
                <div className="grid aspect-[4/3] place-items-center px-2 text-center text-xs text-[var(--muted)]">Image couldn&apos;t load</div>
              ) : (
                // Images live on the company's site; no-referrer avoids hotlink blocking.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt={img.alt ?? `${img.category} photo`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setBroken((b) => new Set(b).add(img.url))}
                  className="aspect-[4/3] w-full object-cover"
                />
              )}
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)] shadow-sm">
                {img.category}
              </span>
              <button
                type="button"
                onClick={() => onChange(images.filter((x) => x.url !== img.url))}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-slate-500 shadow-sm hover:text-rose-600"
                aria-label={`Remove ${img.alt ?? "photo"}`}
              >
                ×
              </button>
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                <span className="truncate text-[var(--muted)]">{img.alt ?? "No description"}</span>
                <a href={img.url} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-[var(--brand)] hover:underline">
                  Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="+ add image URL (press Enter)"
        className={`${bareInput} text-sm`}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

const ITEM_ICON: Record<string, IconName> = { offering: "cube", person: "user", testimonial: "quote", question: "help", profile: "link", idea: "sparkle" };

/** Records as master-detail: item list on the left, the selected item's fields on the right. */
function RecordsEditor({
  field,
  items,
  source,
  hideLabel,
  onChange,
}: {
  field: FieldDef;
  items: Record<string, unknown>[];
  source?: FieldSource;
  hideLabel: boolean;
  onChange: (v: Record<string, unknown>[]) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const columns = field.columns ?? [];
  const item = field.item ?? { label: "item", titleKey: columns[0]?.key ?? "name" };
  const titleCol = columns.find((c) => c.key === item.titleKey);
  // Photo first, so uploading a picture is the first thing you see for a person.
  const otherCols = columns.filter((c) => c.key !== item.titleKey).sort((a, b) => Number(b.kind === "image") - Number(a.kind === "image"));
  const current = Math.min(selected, items.length - 1);
  const icon = ITEM_ICON[item.label] ?? "cube";

  const update = (key: string, v: unknown) => onChange(items.map((it, j) => (j === current ? { ...it, [key]: v } : it)));
  const titleOf = (it: Record<string, unknown>) => String(it[item.titleKey] ?? "").trim() || `Untitled ${item.label}`;
  const photoOf = (it: Record<string, unknown> | undefined) => (typeof it?.photo === "string" && it.photo ? it.photo : null);
  const subtitleOf = (it: Record<string, unknown>) =>
    ([] as string[])
      .concat(item.subtitleKey ?? [])
      .map((k) => String(it[k] ?? "").trim())
      .filter(Boolean)
      .join(" · ");

  const addItem = () => {
    onChange([...items, { ...(field.blank ?? {}) }]);
    setSelected(items.length);
    setJustAdded(true);
  };
  const removeCurrent = () => {
    onChange(items.filter((_, j) => j !== current));
    setSelected(Math.max(0, current - 1));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        {hideLabel ? (
          <span className="sr-only">{field.label}</span>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)]">{field.label}</h3>
            <span className="rounded-full bg-[var(--wash)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">{items.length}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {items.length > 0 && <SourceTag source={source} />}
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-ink)]"
          >
            <Icon name="plus" />
            Add {item.label}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          None found on the site. Use “Add {item.label}” if you know one.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[250px_minmax(0,1fr)]">
          {/* Master list */}
          <ul className="max-h-[540px] space-y-1 overflow-y-auto rounded-2xl border border-[var(--line)] p-2" aria-label={`${field.label} list`}>
            {items.map((it, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(i);
                    setJustAdded(false);
                  }}
                  aria-current={i === current ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    i === current ? "bg-[var(--wash)] ring-1 ring-[var(--brand)]/20" : "hover:bg-slate-50"
                  }`}
                >
                  {photoOf(it) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoOf(it)!} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--wash)] text-[var(--brand)]">
                      <Icon name={icon} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">{titleOf(it)}</span>
                    {subtitleOf(it) && <span className="block truncate text-xs text-[var(--muted)]">{subtitleOf(it)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Detail of the selected item */}
          <div key={current} className="space-y-3 rounded-2xl border border-[var(--line)] p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--brand)]/10">
                {photoOf(items[current]) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoOf(items[current])!} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--wash)] text-[var(--brand)]">
                    <Icon name={icon} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${field.path}-title`} className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {titleCol?.label ?? item.label}
                  </label>
                  {titleCol?.kind === "textarea" ? (
                    <AutoTextarea
                      id={`${field.path}-title`}
                      value={String(items[current]?.[item.titleKey] ?? "")}
                      placeholder={`+ add ${(titleCol?.label ?? item.label).toLowerCase()}`}
                      onChange={(v) => update(item.titleKey, v || null)}
                    />
                  ) : (
                    <input
                      id={`${field.path}-title`}
                      autoFocus={justAdded}
                      className={`${bareInput} font-semibold`}
                      value={String(items[current]?.[item.titleKey] ?? "")}
                      placeholder={`+ add ${(titleCol?.label ?? item.label).toLowerCase()}`}
                      onChange={(e) => update(item.titleKey, e.target.value || null)}
                    />
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={removeCurrent}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {otherCols.map((col) => (
                <RecordCell
                  key={col.key}
                  id={`${field.path}-${current}-${col.key}`}
                  col={col}
                  value={items[current]?.[col.key]}
                  itemName={titleOf(items[current] ?? {})}
                  onChange={(v) => update(col.key, v)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordCell({
  id,
  col,
  value,
  itemName,
  onChange,
}: {
  id: string;
  col: RecordColumn;
  value: unknown;
  itemName: string;
  onChange: (v: unknown) => void;
}) {
  const addLabel = `+ add ${col.label.toLowerCase()}`;
  const wide = col.wide || col.kind === "textarea" || col.kind === "list";
  return (
    <FieldCard htmlFor={id} label={col.label} wide={wide}>
      {col.kind === "image" ? (
        <PhotoInput id={id} value={(value as string) ?? null} name={itemName} onChange={onChange} />
      ) : col.kind === "textarea" ? (
        <AutoTextarea id={id} minRows={col.rows} value={(value as string) ?? ""} placeholder={addLabel} onChange={(v) => onChange(v || null)} />
      ) : col.kind === "list" ? (
        <ListEditor id={id} items={(value as string[]) ?? []} onChange={onChange} addLabel={addLabel} />
      ) : (
        <input
          id={id}
          type={col.kind === "number" ? "number" : "text"}
          className={bareInput}
          value={(value as string | number) ?? ""}
          placeholder={addLabel}
          onChange={(e) => onChange(col.kind === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null)}
        />
      )}
    </FieldCard>
  );
}
