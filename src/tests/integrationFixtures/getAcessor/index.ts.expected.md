# getAcessor/index.ts

## Input

```ts title="getAcessor/index.ts"
/** @gqlQueryField */
export function me(): User {
  return new User();
}

/** @gqlType */
class User {
  /** @gqlField */
  get hello(): string {
    return "Hello world!";
  }
}

export const query = `
  query {
    me {
      hello
    }
  }`;
```

## Output

### Query Result

```json
{
  "data": {
    "me": {
      "hello": "Hello world!"
    }
  }
}
```