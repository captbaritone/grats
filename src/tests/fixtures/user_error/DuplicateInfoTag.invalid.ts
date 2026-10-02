// Every `@gqlInfo` after the first is reported, including the one on Grats'
// own `GqlInfo`, which is read after this file.

/** @gqlInfo */
type Info = { foo: string };

/** @gqlInfo */
type OtherInfo = { bar: string };

/** @gqlInfo */
type YetAnotherInfo = { baz: string };

/** @gqlQueryField */
export function hello(): string {
  return "Hello";
}
