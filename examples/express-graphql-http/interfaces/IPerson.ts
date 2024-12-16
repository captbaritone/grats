import User from "../models/User";

/** @gqlInterface */
export default interface IPerson {
  /** @gqlField */
  name(): string;
}

/** @gqlQueryField */
export function person(): IPerson {
  return new User();
}
