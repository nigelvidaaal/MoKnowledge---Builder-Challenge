// React context + reducer holding the knowledge base being edited.

"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { FieldSource, KnowledgeBase } from "@/types/knowledge";
import { getPath, setPath } from "@/lib/knowledge/path";

/** The two things that can change state: load a whole knowledge base, or set one field. */
type Action =
  | { type: "load"; knowledge: KnowledgeBase; dirty: boolean }
  | { type: "set"; path: string; value: unknown; source?: FieldSource }
  | { type: "reset" };

interface State {
  knowledge: KnowledgeBase | null;
  dirty: boolean;
}

/** The source recorded when a person edits a field. */
const USER_SOURCE: FieldSource = { method: "user", confidence: "high" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return { knowledge: action.knowledge, dirty: action.dirty };
    case "reset":
      return { knowledge: null, dirty: false };
    case "set": {
      if (!state.knowledge) return state;
      const updated = setPath(state.knowledge, action.path, action.value);
      updated.sources = { ...updated.sources, [action.path]: action.source ?? USER_SOURCE };
      return { knowledge: updated, dirty: true };
    }
  }
}

interface EditorApi {
  knowledge: KnowledgeBase | null;
  dirty: boolean;
  /** Replace the whole knowledge base. Pass dirty=true when it has unsaved changes. */
  load: (kb: KnowledgeBase, options?: { dirty?: boolean }) => void;
  reset: () => void;
  get: (path: string) => unknown;
  /** Change one field. Recorded as "Edited by you" unless another source is given. */
  set: (path: string, value: unknown, source?: FieldSource) => void;
  /** The source of a field, falling back to its parent ("extras.compliance"). */
  sourceOf: (path: string) => FieldSource | undefined;
}

const EditorContext = createContext<EditorApi | null>(null);

export function KnowledgeEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { knowledge: null, dirty: false });

  const load = useCallback(
    (knowledge: KnowledgeBase, options?: { dirty?: boolean }) => dispatch({ type: "load", knowledge, dirty: options?.dirty ?? false }),
    [],
  );
  const set = useCallback((path: string, value: unknown, source?: FieldSource) => dispatch({ type: "set", path, value, source }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const api = useMemo<EditorApi>(
    () => ({
      knowledge: state.knowledge,
      dirty: state.dirty,
      load,
      set,
      reset,
      get: (path) => getPath(state.knowledge, path),
      sourceOf: (path) => {
        const sources = state.knowledge?.sources ?? {};
        const parts = path.split(".");
        while (parts.length) {
          const s = sources[parts.join(".")];
          if (s) return s;
          parts.pop();
        }
        return undefined;
      },
    }),
    [state, load, set, reset],
  );

  return <EditorContext.Provider value={api}>{children}</EditorContext.Provider>;
}

export function useKnowledgeEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useKnowledgeEditor must be used inside <KnowledgeEditorProvider>");
  return ctx;
}
