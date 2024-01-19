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

// Sort an array by a key function. Takes care to avoid computing the key
// function more than once per item.
export function sortBy<T>(array: readonly T[], keyFn: (item: T) => number) {
  const keys = new Map<T, number>();
  const memoizedKeyFn = (item: T) => {
    const key = keys.get(item);
    if (key != null) {
      return key;
    }
    const value = keyFn(item);
    keys.set(item, value);
    return value;
  };

  return array.slice().sort((a, b) => memoizedKeyFn(a) - memoizedKeyFn(b));
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
