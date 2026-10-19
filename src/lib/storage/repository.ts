// Storage is behind an interface so the app doesn't care where data lives.

import type { KnowledgeBase } from "@/types/knowledge";

export interface KnowledgeRepository {
  list(): Promise<KnowledgeBase[]>;
  get(id: string): Promise<KnowledgeBase | null>;
  save(kb: KnowledgeBase): Promise<KnowledgeBase>;
  remove(id: string): Promise<boolean>;
}
