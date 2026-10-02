// Only type parameters of the generic GraphQL type itself are supported.
/** @gqlType */
type Page<T> = {
  /** @gqlField */
  items: T[];
};

/** @gqlQueryField */
export function users<T>(): Page<T> {
  return null as any;
}
