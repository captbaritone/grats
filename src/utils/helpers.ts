// Returns null if both are null, otherwise returns the concatenated values of
// the non-null arrays.
export function concatMaybeArrays<T>(a: T[] | null, b: T[] | null): T[] | null {
  if (a == null) return b;
  if (b == null) return a;
  return a.concat(b);
}

export class DefaultMap<K, V> {
  _map: Map<K, V> = new Map();
  constructor(private readonly getDefault: () => V) {}

  get(key: K): V {
    if (!this._map.has(key)) {
      this._map.set(key, this.getDefault());
    }
    return this._map.get(key)!;
  }
}

// Similar to a.push(...b), but avoids potential stack overflows.
export function extend<T>(a: T[], b: T[]) {
  for (const item of b) {
    a.push(item);
  }
}
