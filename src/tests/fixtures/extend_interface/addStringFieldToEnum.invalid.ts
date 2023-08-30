/** @gqlEnum */
type MyEnum = "Foo" | "Bar";

/** @gqlField */
export function greeting(myEnum: MyEnum): string {
  return `Hello ${myEnum}!`;
}
