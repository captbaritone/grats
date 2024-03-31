/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(ctx: Ctx, greeting: string): string {
    if (ctx.id === "1") {
      return `${greeting}, ${this.name}!`;
    } else {
      return "Unauthorized";
    }
  }
}

/** @gqlContext */
type Ctx = {
  id: string;
};
