// Similar to a.push(...b), but avoids potential stack overflows.
export function extend<T>(a: T[], b: readonly T[]) {
  for (const item of b) {
    a.push(item);
  }
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
