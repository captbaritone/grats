// { "strictSemanticNullability": true }

/** @gqlInterface */
interface IPerson {
  /** @gqlField */
  name(): string;
}

/** @gqlType */
export class User implements IPerson {
  __typename = "User" as const;
  /** @gqlField */
  name(): string {
    if (Math.random() < 0.5) {
      throw new Error("Stuff happens...");
    }
    return "Alice";
  }
}
