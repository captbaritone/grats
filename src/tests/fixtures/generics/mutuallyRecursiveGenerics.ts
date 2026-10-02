// Generic types may reference each other with their type parameters.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Parent<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  child: Child<T>;
};

/** @gqlType */
type Child<T> = {
  /** @gqlField */
  parent: Parent<T>;
};

/** @gqlQueryField */
export function parent(): Parent<User> {
  return null as any;
}
