// trim-start
const DB: any = {};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlMutationField */
export function deleteUser(id: string): boolean {
  return DB.deleteUser(id);
}
