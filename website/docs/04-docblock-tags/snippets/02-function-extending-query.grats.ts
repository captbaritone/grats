// trim-start
const DB: any = {};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlQueryField */
export function userById(id: string): User {
  return DB.getUserById(id);
}
