## input

```ts title="functionField/index.ts"
/** @gqlQueryField */
export function hello(): string {
  return "Hello World";
}

export const query = `
    query {
      hello
    }
  `;
```

## Output

```
{
  "data": {
    "hello": "Hello World"
  }
}
```