// trim-start
/** @gqlEnum */
enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

const db = {
  queryUserById(_userId: string): User {
    return { name: "Alice" };
  },
};

// trim-end
/**
 * This objet can be derived from the request/cookies/etc.
 * @gqlContext */
type VC = {
  role: Role;
  userId: string | null;
};

/** @gqlQueryField */
export function getUserById(vc: VC, userId: string): User {
  return queryForUser(vc, userId);
}

// Separate function somewhere in your data layer
function queryForUser(vc: VC, userId: string): User {
  if (vc.role !== Role.ADMIN && vc.userId !== userId) {
    throw new Error("You do not have permission to access this user.");
  }
  return db.queryUserById(userId);
}
