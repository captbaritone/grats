import { Context } from "../context";

/** @gqlInterface */
export default interface IPerson {
  /** @gqlField */
  name(_: unknown, context: Context): Promise<string>;
}
