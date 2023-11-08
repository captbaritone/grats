// trim-start
const DB: any = {};

/** @gqlType */
type Query = unknown;

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlField */
export function userById(_: Query, args: { id: string }): User {
  return DB.getUserById(args.id);
}
