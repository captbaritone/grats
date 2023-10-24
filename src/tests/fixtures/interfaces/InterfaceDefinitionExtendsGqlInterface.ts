import { Int } from "../../../Types";

/** @gqlInterface */
interface Mammal {
  /** @gqlField */
  legs: Int;
}

/** @gqlInterface */
export interface Person extends Mammal {
  /** @gqlField */
  name: string;

  /** @gqlField */
  legs: Int;
}

/** @gqlInterface */
export interface User extends Mammal, Person {
  __typename: "User";

  /** @gqlField */
  name: string;

  /** @gqlField */
  legs: Int;
}
