// trim-start
type Database = {};

// trim-end
/** @gqlContext */
type GQLCtx = {
  req: Request;
  userID: string;
  db: Database;
};
// trim-start

/** @gqlQueryField */
export function userId(ctx: GQLCtx): string {
  return ctx.userID;
}
// trim-end
