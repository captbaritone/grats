// trim-start
const DB: any = {};

/** @gqlType */
type Mutation = unknown;

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlField */
export function deleteUser(_: Mutation, id: string): boolean {
  return DB.deleteUser(id);
}
