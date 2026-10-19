// GET / PUT / DELETE /api/knowledge/:id

import { isKnowledgeBase } from "@/lib/knowledge/validate";
import { fileRepository as repo } from "@/lib/storage/fileRepository";

export const runtime = "nodejs";

/** Next.js 15 passes route params as a Promise, so they're awaited. */
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const item = await repo.get(id);
  return item ? Response.json({ item }) : Response.json({ error: "Not found." }, { status: 404 });
}

/** The body's id must match the URL and already exist. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!isKnowledgeBase(body) || body.id !== id) {
    return Response.json({ error: "That isn't a valid knowledge base for this id." }, { status: 400 });
  }
  if (!(await repo.get(id))) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ item: await repo.save(body) });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const removed = await repo.remove(id);
  return removed ? new Response(null, { status: 204 }) : Response.json({ error: "Not found." }, { status: 404 });
}
