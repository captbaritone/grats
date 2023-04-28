// Returns null if both are null, otherwise returns the concatenated values of
// the non-null arrays.
export function concatMaybeArrays<T>(a: T[] | null, b: T[] | null): T[] | null {
  if (a == null) return b;
  if (b == null) return a;
  return a.concat(b);
}
