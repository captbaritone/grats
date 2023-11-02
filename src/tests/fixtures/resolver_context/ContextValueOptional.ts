/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: never, ctx?: SomeType): string {
    // This is fine since Grats will always pass ctx. It's fine for
    // the resolver to _also_ work _without_ ctx, as long as it's
    // safe for Grats to pass ctx.
    return ctx?.greeting ?? "Hello, World!";
  }
}

/** @gqlContext */
type SomeType = { greeting: string };
