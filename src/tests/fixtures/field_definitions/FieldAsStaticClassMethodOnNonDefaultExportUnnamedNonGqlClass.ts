export class {
  /** @gqlField */
  static greet(_: Query): string {
    return "Hello, world!";
  }
}

/** @gqlType */
type Query = unknown;
