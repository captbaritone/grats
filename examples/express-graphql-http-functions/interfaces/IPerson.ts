import { Context } from "../context";

/** @gqlInterface */
export default interface IPerson {
  /** @gqlField */
  name(_: {}, context: Context): Promise<string>;
}
