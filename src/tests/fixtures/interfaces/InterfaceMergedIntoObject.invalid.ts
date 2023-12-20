declare const Foo: {
  prototype: Foo;
  new (): Foo;
};

/** @gqlInterface */
interface Foo {
  /** @gqlField */
  id: string;
}
