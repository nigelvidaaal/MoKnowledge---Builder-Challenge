// The exact prompts an LLM would receive for the mock-filled fields.

import type { EnhancePrompt } from "@/lib/client/knowledgeApi";

export function PromptsPanel({ prompts, filled }: { prompts: EnhancePrompt[]; filled: string[] }) {
  return (
    <section id="ai-prompts" className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-6">
      <h2 className="text-lg font-semibold">How AI would fill the gaps</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        No language model was called. {filled.length} empty {filled.length === 1 ? "field was" : "fields were"} filled with labeled placeholders. In production, these
        prompts would be sent with the scraped data, and every answer would come back with quoted evidence for review.
      </p>
      <div className="mt-4 space-y-3">
        {prompts.map((p) => (
          <details key={p.id} className="group rounded-xl border border-[var(--line)] bg-white">
            <summary className="cursor-pointer list-none px-4 py-3">
              <span className="font-medium">{p.title}</span>
              <span className="mt-0.5 block text-sm text-[var(--muted)]">{p.purpose}</span>
            </summary>
            <div className="space-y-3 border-t border-[var(--line)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Fills: {p.fills.join(", ")}</p>
              <PromptBlock label="System" text={p.system} />
              <PromptBlock label="User" text={p.user} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--muted)]">{label}</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{text}</pre>
    </div>
  );
}
