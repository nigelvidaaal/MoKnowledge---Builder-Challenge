// Color picker: saturation/brightness square, hue slider, hex input and preview.

"use client";

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/** HSV, because the square is saturation x value. */
interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

/** normalizeHex("2663EB") -> "#2663eb"; also expands 3-digit codes. */
export function normalizeHex(input: string): string | null {
  const t = input.trim();
  const six = t.match(HEX6);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = t.match(HEX3);
  if (three) return `#${[...three[1].toLowerCase()].map((c) => c + c).join("")}`;
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex(f(5) * 255, f(3) * 255, f(1) * 255);
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const { h } = hexToHsv(hex);
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1e2433" : "#ffffff";
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function ColorPicker({
  initial = "#2663eb",
  confirmLabel = "Add color",
  onConfirm,
  onCancel,
}: {
  initial?: string;
  confirmLabel?: string;
  onConfirm: (hex: string) => void;
  onCancel: () => void;
}) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(normalizeHex(initial) ?? "#2663eb"));
  const hex = hsvToHex(hsv);
  // Separate draft so a half-typed hex code doesn't move the picker.
  const [hexDraft, setHexDraft] = useState(hex);
  const square = useRef<HTMLDivElement>(null);
  const ids = useId();

  const update = (next: Hsv) => {
    setHsv(next);
    setHexDraft(hsvToHex(next));
  };

  const pickFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = square.current!.getBoundingClientRect();
    update({ ...hsv, s: clamp((e.clientX - rect.left) / rect.width), v: clamp(1 - (e.clientY - rect.top) / rect.height) });
  };

  const onSquareKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - step) },
      ArrowRight: { s: clamp(hsv.s + step) },
      ArrowUp: { v: clamp(hsv.v + step) },
      ArrowDown: { v: clamp(hsv.v - step) },
    };
    if (moves[e.key]) {
      e.preventDefault();
      update({ ...hsv, ...moves[e.key] });
    }
  };

  const onHexInput = (value: string) => {
    setHexDraft(value);
    const valid = normalizeHex(value);
    if (valid) setHsv(hexToHsv(valid));
  };

  const [r, g, b] = hexToRgb(hex);
  const [hh, ss, ll] = hexToHsl(hex);
  const hexValid = normalizeHex(hexDraft) !== null;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_12px_32px_-16px_rgba(16,24,40,0.25)]">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
        <div className="space-y-3">
          {/* Saturation (left to right) and brightness (bottom to top) for the current hue. */}
          <div
            ref={square}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            aria-valuenow={Math.round(hsv.s * 100)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pickFromPointer(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && pickFromPointer(e)}
            onKeyDown={onSquareKey}
            className="relative h-44 w-full cursor-crosshair touch-none rounded-xl"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
            />
          </div>

          {/* Hue: a native range input, so it works with keyboard and screen readers. */}
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            onChange={(e) => update({ ...hsv, h: Number(e.target.value) })}
            aria-label="Hue"
            className="hue-range w-full"
          />

          <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 focus-within:border-[var(--brand)]">
            <span className="h-6 w-6 shrink-0 rounded-full border border-black/10" style={{ background: hex }} aria-hidden />
            <label htmlFor={`${ids}-hex`} className="text-sm text-[var(--muted)]">
              Hex
            </label>
            <input
              id={`${ids}-hex`}
              value={hexDraft}
              onChange={(e) => onHexInput(e.target.value)}
              spellCheck={false}
              aria-invalid={!hexValid}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-[var(--ink)] focus:outline-none focus-visible:outline-none"
              placeholder="#2663EB"
            />
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span>
              RGB <span className="font-medium text-[var(--ink)]">{r}, {g}, {b}</span>
            </span>
            <span>
              HSL <span className="font-medium text-[var(--ink)]">{hh}, {ss}%, {ll}%</span>
            </span>
            {!hexValid && <span className="text-rose-700">Enter a code like #2663EB</span>}
          </p>
        </div>

        {/* Large preview, like the reference color tool. */}
        <div
          className="grid min-h-28 place-items-center rounded-xl font-mono text-sm font-semibold uppercase"
          style={{ background: hex, color: readableOn(hex) }}
          aria-hidden
        >
          {hex}
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-[var(--line)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--wash)]">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(hex)}
          className="rounded-xl bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-ink)]"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
