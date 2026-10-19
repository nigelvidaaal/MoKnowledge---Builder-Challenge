// Browser-side calls to the knowledge API, with readable errors.

import type { KnowledgeBase } from "@/types/knowledge";

/** fetch + JSON; throws the server's error message. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const knowledgeApi = {
  list: () => request<{ items: KnowledgeBase[] }>("/api/knowledge").then((d) => d.items),
  get: (id: string) => request<{ item: KnowledgeBase }>(`/api/knowledge/${id}`).then((d) => d.item),
  create: (kb: KnowledgeBase) =>
    request<{ item: KnowledgeBase }>("/api/knowledge", { method: "POST", body: JSON.stringify(kb) }).then((d) => d.item),
  update: (kb: KnowledgeBase) =>
    request<{ item: KnowledgeBase }>(`/api/knowledge/${kb.id}`, { method: "PUT", body: JSON.stringify(kb) }).then((d) => d.item),
  remove: (id: string) => request<void>(`/api/knowledge/${id}`, { method: "DELETE" }),
  enhance: (kb: KnowledgeBase, paths?: string[]) =>
    request<{ knowledge: KnowledgeBase; filled: string[]; prompts: EnhancePrompt[] }>("/api/enhance", {
      method: "POST",
      body: JSON.stringify({ knowledge: kb, paths }),
    }),
};

export interface EnhancePrompt {
  id: string;
  title: string;
  purpose: string;
  fills: string[];
  system: string;
  user: string;
}

export function downloadJson(kb: KnowledgeBase) {
  const name = (kb.foundation.name ?? new URL(kb.sourceUrl).hostname).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const blob = new Blob([JSON.stringify(kb, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-knowledge.json`;
  a.click();
  URL.revokeObjectURL(url);
}
