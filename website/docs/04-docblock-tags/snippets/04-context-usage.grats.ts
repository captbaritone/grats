// trim-start
type Database = {
  users: { getById(id: string): User };
};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// trim-end
/** @gqlContext */
type GQLCtx = {
  req: Request;
  userID: string;
  db: Database;
};

/** @gqlQueryField */
// highlight-start
export function me(ctx: GQLCtx): User {
  // highlight-end
  return ctx.db.users.getById(ctx.userID);
}
