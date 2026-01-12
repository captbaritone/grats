# derivedContextAsync/index.ts

## Input

```ts title="derivedContextAsync/index.ts"
/** @gqlContext */
type Ctx = {};

type SomeCtx = { name: string };

/** @gqlContext */
export async function derived(): Promise<SomeCtx> {
  return { name: "Roger" };
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  /** @gqlField */
  greeting(someCtx: SomeCtx): string {
    return `Hello ${this.name}, from ${someCtx.name}`;
  }

  /** @gqlQueryField */
  static currentUser(someCtx: SomeCtx): User {
    return new User(someCtx.name);
  }
}

/** @gqlQueryField */
export function hello(someCtx: SomeCtx): string {
  return `Hello ${someCtx.name}`;
}

/** @gqlQueryField */
export function user(someCtx: SomeCtx): User {
  return new User(someCtx.name);
}

export const query = `
    query {
      hello
      user {
        name
        greeting
      }
      currentUser {
        name
        greeting
      }
    }
  `;
```

## Output

### Query Result

```json
{
  "data": {
    "hello": "Hello Roger",
    "user": {
      "name": "Roger",
      "greeting": "Hello Roger, from Roger"
    },
    "currentUser": {
      "name": "Roger",
      "greeting": "Hello Roger, from Roger"
    }
  }
}
```