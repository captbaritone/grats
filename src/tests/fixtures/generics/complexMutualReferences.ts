// `Foo` and `Bar` pass their type parameter to each other, but neither uses it
// in a GraphQL position, so they're not generic.
/** @gqlType */
type Foo<T> = {
  /** @gqlField */
  someField: Bar<T>;
  /** @gqlField */
  baz: Baz;
};

/** @gqlType */
type Bar<T> = {
  /** @gqlField */
  anotherField: Foo<T>;
};

/** @gqlType */
type Baz = {
  /** @gqlField */
  bazField: Bar<Baz>;
};
