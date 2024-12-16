/** @gqlType */
type Query = unknown;

/**
 * @gqlInput
 */
type SomeObj = {
  a: string;
};

/**
 * @gqlField
 */
export function hello(
  _: Query,
  {
    someObj = { a: "Sup" },
  }: {
    someObj: SomeObj;
  },
): string {
  return someObj.a;
}

export const query = `
    query {
      hello
    }
  `;
