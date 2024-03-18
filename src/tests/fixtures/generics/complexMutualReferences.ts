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
