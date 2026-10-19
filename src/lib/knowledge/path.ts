// Read/write nested values by dotted path ("foundation.phone"); setPath is immutable.

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur === null || cur === undefined) return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const current = (obj as Record<string, unknown>) ?? {};
  return {
    ...current,
    [head]: rest.length ? setPath(current[head], rest.join("."), value) : value,
  } as T;
}
