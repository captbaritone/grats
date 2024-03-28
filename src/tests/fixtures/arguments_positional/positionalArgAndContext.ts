/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(greeting: string, ctx: Ctx): string {
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
