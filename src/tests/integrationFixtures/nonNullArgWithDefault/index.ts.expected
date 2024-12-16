-----------------
INPUT
----------------- 
/** @gqlQueryField */
export function hello({ greeting = "Hello" }: { greeting: string }): string {
  return `${greeting}, world!`;
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
    "hello": "Hello, world!"
  }
}