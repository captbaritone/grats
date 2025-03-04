// trim-start
type DB = {
  selectUser(): { name: string };
  /*...*/
};

// trim-end
/** @gqlContext */
type Ctx = { db: DB };

// highlight-start
/** @gqlContext */
export function getDb(ctx: Ctx): DB {
  return ctx.db;
}
// highlight-end

/**
 * A field which reads a derived context. Grats will invoke the above `getDb`
 * function and pass it to this resolver function.
 *
 * @gqlQueryField */
export function me(db: DB): string {
  return db.selectUser().name;
}
