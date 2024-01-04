// { "strictSemanticNullability": true }

/** @gqlType */
export class User {
  /** @gqlField */
  name(): string | null {
    if (Math.random() < 0.25) {
      return null;
    }
    if (Math.random() < 0.5) {
      throw new Error("Stuff happens...");
    }
    return "Alice";
  }
}
