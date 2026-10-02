// `Bar` doesn't use its type parameter in a GraphQL position, so neither does
// `Foo`, and `Foo`'s type argument need not be a GraphQL type.
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
