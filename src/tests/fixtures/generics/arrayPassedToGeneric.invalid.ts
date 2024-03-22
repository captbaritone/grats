/** @gqlType */
type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
export type SomeType<T> = {
  /** @gqlField */
  someField: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Foo = {
  // We should be able to support this eventually
  /** @gqlField */
  a: SomeType<Page[]>;
  // We should be able to support this eventually
  /** @gqlField */
  b: SomeType<Array<Page>>;
  /** @gqlField */
  c: SomeType<Page | null>;
};
