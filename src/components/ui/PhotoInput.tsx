// Upload, preview and remove a photo (used for Key people).

"use client";

import { useState } from "react";
import { Icon } from "./Icon";

const MAX_SIDE = 256; // pixels; plenty for an avatar, keeps the JSON small (~15-30 KB)
const MAX_UPLOAD_MB = 10;

/** Shrinks to 256px max and returns a JPEG data URL (keeps saved JSON small). */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoInput({ id, value, name, onChange }: { id: string; value: string | null; name?: string; onChange: (v: string | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose an image file (JPG, PNG, WebP…).");
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setError(`That image is over ${MAX_UPLOAD_MB} MB.`);
    setBusy(true);
    try {
      onChange(await shrinkImage(file));
    } catch {
      setError("Couldn't read that image. Try a different file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={name ? `${name}` : "Uploaded photo"} className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-[var(--line)]" />
      ) : (
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--wash)] text-[var(--brand)]">
          <Icon name="user" className="h-7 w-7" />
        </span>
      )}
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={id}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:border-[var(--brand)] hover:text-[var(--brand)] focus-within:border-[var(--brand)]"
          >
            <Icon name="upload" />
            {busy ? "Processing…" : value ? "Replace photo" : "Upload photo"}
            <input
              id={id}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = ""; // allow choosing the same file again
              }}
            />
          </label>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="rounded-xl px-2 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-rose-700">
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">{error ? <span className="text-rose-700">{error}</span> : "JPG, PNG or WebP. Resized to 256px."}</p>
      </div>
    </div>
  );
}
