// trim-start
class DB {
  selectUser(): { name: string } {
    return { name: "Alice" };
  }
}

// trim-end
/** @gqlContext */
type Ctx = {};

// A derived context resolver cached using a WeakMap to ensure the value is
// computed at most once per request.

const DB_CACHE = new WeakMap<Ctx, DB>();

// highlight-start
/** @gqlContext */
export function getDb(ctx: Ctx): DB {
  if (!DB_CACHE.has(ctx)) {
    DB_CACHE.set(ctx, new DB());
  }
  return DB_CACHE.get(ctx)!;
}
// highlight-end

/**
 * @gqlQueryField */
export function me(db: DB): string {
  return db.selectUser().name;
}
