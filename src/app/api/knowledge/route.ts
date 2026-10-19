// GET /api/knowledge lists all (newest first); POST saves one.

import { isKnowledgeBase } from "@/lib/knowledge/validate";
import { fileRepository as repo } from "@/lib/storage/fileRepository";

export const runtime = "nodejs";

export async function GET() {
  const items = await repo.list();
  return Response.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isKnowledgeBase(body)) {
    return Response.json({ error: "That isn't a valid knowledge base." }, { status: 400 });
  }
  try {
    const saved = await repo.save(body);
    return Response.json({ item: saved }, { status: 201 });
  } catch (err) {
    console.error("[knowledge:save]", err);
    return Response.json({ error: "Could not save the knowledge base." }, { status: 500 });
  }
}
