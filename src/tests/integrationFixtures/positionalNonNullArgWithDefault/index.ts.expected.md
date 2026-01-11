# positionalNonNullArgWithDefault/index.ts

## Input

```ts title="positionalNonNullArgWithDefault/index.ts"
/** @gqlQueryField */
export function hello(greeting: string = "Hello"): string {
  return `${greeting}, world!`;
}

export const query = `
    query {
      hello
    }
  `;
```

## Output

### Query Result

```json
{
  "data": {
    "hello": "Hello, world!"
  }
}
```