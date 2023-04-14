// trim-start
const DB: any = {};

/** @gqlType */
type Mutation = {};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlField */
export function deleteUser(_: Mutation, args: { id: string }): boolean {
  return DB.deleteUser(args.id);
}
