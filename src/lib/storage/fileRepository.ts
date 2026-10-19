// Storage: one JSON file per knowledge base in data/knowledge/<id>.json.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { KnowledgeBase } from "@/types/knowledge";
import type { KnowledgeRepository } from "./repository";

const DIR = join(process.cwd(), "data", "knowledge");

// IDs become file names, so only allow UUID-shaped IDs.
const SAFE_ID = /^[0-9a-f-]{36}$/i;

function pathFor(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error("Invalid knowledge base id");
  return join(DIR, `${id}.json`);
}

export const fileRepository: KnowledgeRepository = {
  async list() {
    await mkdir(DIR, { recursive: true });
    const files = (await readdir(DIR)).filter((f) => f.endsWith(".json"));
    const items = await Promise.all(
      files.map(async (f) => {
        try {
          return JSON.parse(await readFile(join(DIR, f), "utf8")) as KnowledgeBase;
        } catch {
          return null; // skip a corrupted file instead of breaking the list
        }
      }),
    );
    return items
      .filter((k): k is KnowledgeBase => k !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id) {
    try {
      return JSON.parse(await readFile(pathFor(id), "utf8")) as KnowledgeBase;
    } catch {
      return null;
    }
  },

  async save(kb) {
    await mkdir(DIR, { recursive: true });
    const saved = { ...kb, updatedAt: new Date().toISOString() };
    await writeFile(pathFor(kb.id), JSON.stringify(saved, null, 2), "utf8");
    return saved;
  },

  async remove(id) {
    try {
      await rm(pathFor(id));
      return true;
    } catch {
      return false;
    }
  },
};
