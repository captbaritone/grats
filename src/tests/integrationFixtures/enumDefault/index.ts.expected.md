# enumDefault/index.ts

## Input

```ts title="enumDefault/index.ts"
// https://github.com/captbaritone/grats/issues/172#issuecomment-2685496600

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlQueryField */
export function hello(greeting: GreetingOptions | null = "Greetings"): string {
  return `${greeting} World`;
}

export const query = /* GraphQL */ `
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
    "hello": "Greetings World"
  }
}
```