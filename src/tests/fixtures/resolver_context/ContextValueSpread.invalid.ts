/** @gqlType */
export class Query {
  /** @gqlField */
  greeting(args: unknown, ...ctx: SomeType): string {
    return ctx[0].greeting;
  }
}

type SomeType = { greeting: string };
