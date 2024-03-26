type Ctx = {};

/** @gqlType */
class User {
  /** @gqlField */
  greeting(_args: unknown, _ctx: Ctx): string {
    return "Hello";
  }
}
