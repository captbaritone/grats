// { "strictSemanticNullability": true }

/** @gqlType */
export class User {
  /** @gqlField */
  name(): string {
    if (Math.random() < 0.5) {
      throw new Error("Stuff happens...");
    }
    return "Alice";
  }
}
