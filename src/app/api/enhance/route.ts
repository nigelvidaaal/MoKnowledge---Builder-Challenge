// POST /api/enhance: mock AI fill plus the prompts a real LLM would get.

import type { KnowledgeBase } from "@/types/knowledge";
import { mockEnhance } from "@/lib/ai/mockEnhance";
import { PROMPTS } from "@/prompts";

export async function POST(request: Request) {
  let body: { knowledge?: KnowledgeBase; paths?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!body.knowledge?.foundation) {
    return Response.json({ error: "Missing knowledge base." }, { status: 400 });
  }

  // Only fill these field paths (one section's "Fill with AI" button).
  const only = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === "string") : undefined;

  const { knowledge, filled } = mockEnhance(body.knowledge, only);
  const prompts = PROMPTS.filter((p) => !only || p.fills.some((f) => only.includes(f))).map((p) => ({
    id: p.id,
    title: p.title,
    purpose: p.purpose,
    fills: p.fills,
    ...p.build(body.knowledge!, {}),
  }));

  // A short pause so the UI's loading state is visible, like a real model call.
  await new Promise((r) => setTimeout(r, 600));

  return Response.json({ knowledge, filled, prompts, mock: true });
}
