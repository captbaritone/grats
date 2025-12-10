## input

```ts title="nonNullEnumDefault/index.ts"
// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlQueryField */
export function hello(greeting: GreetingOptions = "Greetings"): string {
  return `${greeting} World`;
}

export const query = /* GraphQL */ `
  query {
    hello
  }
`;
```

## Output

```
{
  "data": {
    "hello": "Greetings World"
  }
}
```