// trim-start
/** @gqlEnum */
enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
  GUEST = "GUEST",
}

/** @gqlContext */
type Ctx = {
  role: Role;
};

/**
 * @gqlDirective assert on FIELD_DEFINITION
 */
export function requiresRole(_args: { is: Role }, _context: Ctx): void {}

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

const db = {
  queryAllUsers(): User[] {
    return [];
  },
};

// trim-end
/**
 * @gqlQueryField
 * @gqlAnnotate assert(is: ADMIN)
 */
export function getAllUsers(): User[] {
  return db.queryAllUsers();
}
