## input

```ts title="nonNullArgWithDefault/index.ts"
/** @gqlQueryField */
export function hello({ greeting = "Hello" }: { greeting: string }): string {
  return `${greeting}, world!`;
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
    "hello": "Hello, world!"
  }
}
```