-----------------
INPUT
----------------- 
/** @gqlQueryField */
export function hello(): string {
  return "Hello World";
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
    "hello": "Hello World"
  }
}