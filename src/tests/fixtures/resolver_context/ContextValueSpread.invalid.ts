/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(args: unknown, ...ctx: SomeType): string {
    return ctx[0].greeting;
  }
}

type SomeType = { greeting: string };
