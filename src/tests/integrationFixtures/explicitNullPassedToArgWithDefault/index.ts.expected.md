## input

```ts title="explicitNullPassedToArgWithDefault/index.ts"
/**
 * Validating what graphql-js does when an explicit null is passed to an argument
 * with a default value.
 *
 * Spoiler alert: it passes the explicit null.
 */

/**
 * @gqlQueryField
 */
export function hello({
  someArg = "Hello",
}: {
  someArg?: string | null;
}): string {
  if (someArg === null) {
    return "got null";
  }
  return `${someArg} World`;
}

export const query = `
    query {
      hello(someArg: null)
    }
  `;
```

## Output

```
{
  "data": {
    "hello": "got null"
  }
}
```