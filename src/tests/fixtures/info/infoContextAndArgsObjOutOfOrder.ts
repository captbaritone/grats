import { Info } from "../../../Types";

/** @gqlType */
class User {
  /** @gqlField */
  greeting(info: Info, ctx: Ctx, args: { someArg: string }): string {
    return "Hello!";
  }
}

/** @gqlContext */
type Ctx = string;
