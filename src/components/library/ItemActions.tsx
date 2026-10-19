// The Edit / Re-scrape / Export / Delete buttons for one saved knowledge base.

"use client";

import Link from "next/link";
import { useState } from "react";
import type { KnowledgeBase } from "@/types/knowledge";
import { downloadJson } from "@/lib/client/knowledgeApi";

export function ItemActions({ kb, onDelete }: { kb: KnowledgeBase; onDelete: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const link = "rounded-md px-2 py-1 text-sm font-medium hover:bg-[var(--wash)]";

  if (confirming) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Confirm delete">
        <span className="text-sm text-rose-700">Delete this knowledge base?</span>
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            await onDelete(kb.id);
          }}
          className="rounded-md bg-rose-600 px-2 py-1 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={link}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link href={`/knowledge?id=${kb.id}`} className={`${link} text-[var(--brand)]`}>
        Edit
      </Link>
      <Link href={`/knowledge?url=${encodeURIComponent(kb.sourceUrl)}`} className={link}>
        Re-scrape
      </Link>
      <button type="button" onClick={() => downloadJson(kb)} className={link}>
        Export
      </button>
      <button type="button" onClick={() => setConfirming(true)} className={`${link} text-rose-700`}>
        Delete
      </button>
    </div>
  );
}
