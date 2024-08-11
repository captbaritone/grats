/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(...ctx: SomeOtherType[]): string {
    return ctx[0].greeting;
  }
}

/** @gqlContext */
type SomeOtherType = { greeting: string };
