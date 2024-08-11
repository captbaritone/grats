import { Location } from "graphql";

export class DefaultMap<K, V> {
  _map: Map<K, V> = new Map();
  constructor(private readonly getDefault: () => V) {}

  get(key: K): V {
    if (!this._map.has(key)) {
      this._map.set(key, this.getDefault());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._map.get(key)!;
  }
}

// Similar to a.push(...b), but avoids potential stack overflows.
export function extend<T>(a: T[], b: readonly T[]) {
  for (const item of b) {
    a.push(item);
  }
}

export function loc(item: { loc?: Location }): Location {
  if (item.loc == null) {
    throw new Error("Expected item to have loc");
  }
  return item.loc;
}

export function astNode<T>(item: { astNode?: T | undefined | null }): T {
  if (item.astNode == null) {
    throw new Error("Expected item to have astNode");
  }
  return item.astNode;
}

let i = 0;
export function uniqueId() {
  return i++;
}

export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      `Grats Error. Invariant failed: ${message}. This error represents an error in Grats. Please report it.`,
    );
  }
}

export function nullThrows<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error(
      "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    );
  }
  return value;
}
