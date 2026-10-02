// Type parameter defaults are not supported.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Page<T = User> = {
  /** @gqlField */
  items: T[];
};

/** @gqlQueryField */
export function users(): Page {
  return null as any;
}
