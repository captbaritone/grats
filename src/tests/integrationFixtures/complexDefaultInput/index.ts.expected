-----------------
INPUT
----------------- 
/**
 * @gqlInput
 */
type SomeObj = {
  a: string;
};

/**
 * @gqlQueryField
 */
export function hello({
  someObj = { a: "Sup" },
}: {
  someObj: SomeObj;
}): string {
  return someObj.a;
}

export const query = `
    query {
      hello
    }
  `;

-----------------
OUTPUT
-----------------
{
  "data": {
    "hello": "Sup"
  }
}