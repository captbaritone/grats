function main() {
  /** @gqlType */
  export class User {
    /** @gqlField */
    name: string;

    /** @gqlField */
    static getUser(_: Query): User {
      return new User();
    }
  }
}

/** @gqlType */
type Query = unknown;
