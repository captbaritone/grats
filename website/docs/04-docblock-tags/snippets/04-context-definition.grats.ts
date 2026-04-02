// trim-start
type Database = {};

// trim-end
/** @gqlContext */
type GQLCtx = {
  req: Request;
  userID: string;
  db: Database;
};
