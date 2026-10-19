// The logo, name, domain and color strip for one company.

"use client";

import { useState } from "react";
import type { KnowledgeBase } from "@/types/knowledge";

export function BrandIdentity({ kb, size = "md" }: { kb: KnowledgeBase; size?: "sm" | "md" }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = kb.branding.logos[0];
  const name = kb.foundation.name ?? "Unnamed company";
  const domain = (() => {
    try {
      return new URL(kb.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return kb.sourceUrl;
    }
  })();
  const box = size === "sm" ? "h-10 w-10" : "h-14 w-14";

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className={`${box} grid shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-white`}>
          {logo && !logoFailed ? (
            // Logos come from arbitrary domains, so a plain <img> avoids next/image domain config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="max-h-full max-w-full object-contain p-1" onError={() => setLogoFailed(true)} />
          ) : (
            <span className="text-lg font-semibold text-[var(--muted)]">{name.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className={`truncate font-semibold ${size === "sm" ? "text-sm" : "text-lg"}`}>{name}</p>
          <a href={kb.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-sm text-[var(--muted)] hover:text-[var(--brand)]">
            {domain}
          </a>
        </div>
      </div>
      {kb.branding.colors.length > 0 && (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full ring-1 ring-[var(--line)]" aria-label="Brand colors">
          {kb.branding.colors.map((c, i) => (
            <span key={`${c}-${i}`} className="flex-1" style={{ background: c }} title={c} />
          ))}
        </div>
      )}
    </div>
  );
}
