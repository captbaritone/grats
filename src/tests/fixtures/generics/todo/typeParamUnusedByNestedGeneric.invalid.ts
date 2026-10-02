// TODO: This should not be an error. `Bar` doesn't use its type parameter in a
// GraphQL position, so `Foo`'s type parameter need not be a GraphQL type.
/** @gqlType */
type Bar<U> = {
  /** @gqlField */
  name: string;
  notGql: U;
};

/** @gqlType */
type Foo<T> = {
  /** @gqlField */
  bar: Bar<T>;
};

/** @gqlQueryField */
export function foo(): Foo<string> {
  return null as any;
}
