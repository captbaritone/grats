// References which differ only in type arguments for type parameters not used
// in a GraphQL position are the same GraphQL type.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Page<T, Cursor> = {
  /** @gqlField */
  items: T[];
  cursor: Cursor;
};

/** @gqlQueryField */
export function byId(): Page<User, string> {
  return null as any;
}

/** @gqlQueryField */
export function byOffset(): Page<User, number> {
  return null as any;
}
