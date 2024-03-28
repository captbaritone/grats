/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
}

/** @gqlField */
export function greeting(user: User, ctx: Ctx): string {
  if (ctx.id === "1") {
    return `Hello, ${user.name}!`;
  } else {
    return "Unauthorized";
  }
}

/** @gqlContext */
type Ctx = {
  id: string;
};
