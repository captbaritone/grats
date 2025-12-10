## input

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

```
{
  "data": {
    "me": {
      "hello": "Hello world!"
    }
  }
}
```