/** @gqlType */
export class SomeType {
  /** @gqlField */
  someField: string;

  /** @gqlField greeting */
  static greetz(_: Query, args: unknown, ctx: unknown, info): string {
    return "Hello";
  }
}

/** @gqlType */
type Query = unknown;
