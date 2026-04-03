# Permissions

One common challenge of API implementation is enforcing permissions. For example, users may only be allowed to read or modify certain data based on their role, ownership of the data, or other factors.

Three different approaches which work well with Grats are discussed below:

-   [Viewer Context Approach](#viewer-context)\ - Pass context about the user into the data layer and enforce permissions there.
-   [Permission Directives](#permission-directives)\ - Annotate fields with the permissions required to access them using GraphQL directives and enforce them in the GraphQL layer.
-   [Permission Tokens with Derived Contexts](#permission-tokens-with-derived-contexts)\ - Leverage TypeScript types and Grats' derived contexts to enforce permissions in a type-safe way.

## Viewer Context

If possible, it's best to enforce permissions as close to the data source as possible and _not_ in the GraphQL layer. This way you can ensure your privacy rules apply regardless of how the data is accessed, whether via GraphQL or some other means.

One highly effective pattern is to have an object representing the user making the request (often called "ViewerContext" or "VC"). Any database fetch that requires specific permissions should require one of these objects as an argument and enforce the permissions at that layer and then use properties on that object to determine if the data can be read/updated. If not, an error should be thrown. Grats makes accessing such an object easy with [Derived Contexts](../docblock-tags/context.md#derived-context-values).

```tsx
/** @gqlEnum */
enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

const db = {
  queryUserById(_userId: string): User {
    return { name: "Alice" };
  },
};

/**
 * This objet can be derived from the request/cookies/etc.
 * @gqlContext */
type VC = {
  role: Role;
  userId: string | null;
};

/** @gqlQueryField */
export function getUserById(vc: VC, userId: string): User {
  return queryForUser(vc, userId);
}

// Separate function somewhere in your data layer
function queryForUser(vc: VC, userId: string): User {
  if (vc.role !== Role.ADMIN && vc.userId !== userId) {
    throw new Error("You do not have permission to access this user.");
  }
  return db.queryUserById(userId);
}
```

The `VC` object can also be passed through model constructors to avoid needing to pass it explicitly through every field resolver:

```tsx
type VC = {};

/** @gqlType */
class Post {
  constructor(_vc: VC) {}

  /** @gqlField */
  title: string;
}

/** @gqlType */
class User {
  constructor(private vc: VC /* ... other fields */) {}

  /** @gqlField */
  post(): Post {
    return new Post(this.vc);
  }
}
```

## Permission Directives

If you do decide to enforce permissions in the GraphQL layer, one approach is to use [Directives](https://graphql.org/learn/queries/#directives) to annotate fields with the permissions required to access them.

By returning [`FieldDirective`](../docblock-tags/directive-definitions.md#field-directive-wrappers) from your directive function, Grats will automatically wrap the field resolver with your permission check — no manual schema transformation needed.

This approach means that the permission requirements end up visible in your generated GraphQL schema. It can be useful for clients to know what permissions are required to access certain fields, but in some cases permissions are not intended to be public knowledge, so be sure to consider whether this is appropriate for your use case.

Note that schema directives are not exposed through GraphQL introspection, so they will not be visible to clients who access the schema that way.

Usage on each restricted field looks like this:

```tsx
/** @gqlEnum */
enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
  GUEST = "GUEST",
}

/** @gqlContext */
type Ctx = {
  role: Role;
};

/**
 * @gqlDirective assert on FIELD_DEFINITION
 */
export function requiresRole(_args: { is: Role }, _context: Ctx): void {}

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

const db = {
  queryAllUsers(): User[] {
    return [];
  },
};

/**
 * @gqlQueryField
 * @gqlAnnotate assert(is: ADMIN)
 */
export function getAllUsers(): User[] {
  return db.queryAllUsers();
}
```

_Generated GraphQL schema:_

```graphql
directive @assert(is: Role!) on FIELD_DEFINITION

enum Role {
  ADMIN
  GUEST
  USER
}

type Query {
  getAllUsers: [User!] @assert(is: ADMIN)
}

type User {
  name: String
}
```

The directive implementation uses `FieldDirective` to wrap the resolver with a permission check:

```ts
import { GraphQLError } from "graphql";
import { FieldDirective } from "grats";

/** @gqlContext */
type Ctx = {
  role: Role;
};

/** @gqlEnum */
export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
  GUEST = "GUEST",
}

/**
 * Indicates that a field requires the specified role to access.
 * @gqlDirective assert on FIELD_DEFINITION
 */
export function requiresRole(args: { is: Role }): FieldDirective {
  return (next) => (source, resolverArgs, context: Ctx, info) => {
    if (args.is !== context.role) {
      throw new GraphQLError(
        "You do not have permission to access this field.",
      );
    }
    return next(source, resolverArgs, context, info);
  };
}
```

## Permission Tokens with Derived Contexts

Grats' novel [Derived Contexts](../docblock-tags/context.md#derived-context-values) feature can be used to implement a "permission tokens" pattern where permission token is a special object that represents that the bearer has a given permission.

### Assert Tokens

You can construct a derived context type which will cause a field to throw if the user does not have the required permissions.

Usage on each restricted field looks like this:

```tsx
type AdminToken = "AdminToken" & { __brand: "AdminToken" };
type AssertAdminToken = AdminToken;

/** @gqlContext */
type Ctx = {
  isAdmin: true;
};

/** @gqlContext */
export function adminCheck(ctx: Ctx): AssertAdminToken {
  if (!ctx.isAdmin) {
    throw new Error("You do not have permission to access this field");
  }
  return "AdminToken" as AdminToken;
}

/**
 * This field will throw for any user that is not an admin. This is enabled
 * simply by adding an argument typed as `AssertAdminToken`, even if it's
 * unused.
 *
 * @gqlQueryField */
export function someField(_admin: AssertAdminToken): string {
  return "You must be an admin!";
}
```

Since Grats will call the context deriver as part of field execution, if the derive function throws it will be treated as an error for that field, preventing access.

The implementation of the `AssertAdminToken` type and its derived context function looks like this:

```tsx
/**
 * The main GraphQL context object, derived from the request/cookies.
 * @gqlContext
 */
type Ctx = {
  isAdmin: true;
};

// Use "branded types" to ensure nobody else can construct an AdminToken.
// https://egghead.io/blog/using-branded-types-in-typescript
type AdminToken = "AdminToken" & { __brand: "AdminToken" };

type AssertAdminToken = AdminToken;

/**
 * @gqlContext
 */
export function adminCheck(ctx: Ctx): AssertAdminToken {
  if (!ctx.isAdmin) {
    throw new Error("You do not have permission to access this field");
  }
  return "AdminToken" as AdminToken;
}
```

### Maybe Tokens

Permission tokens can also be used similarly to the Viewer Context approach above, where the permission token is a required parameter deep in the data layer.

In this case, you can define a "maybe" derived context type which is either the permission token or `null` if the user does not have the required permissions. This yields control to the field resolver to decide how to handle the case where the user does not have the required permissions while ensuring that the permission check is always performed at some point _before_ reaching the data layer.

These two token approaches can also be combined!

```tsx
type AdminToken = "AdminToken" & { __brand: "AdminToken" };

/**
 * @gqlContext
 */
type Ctx = {
  isAdmin: boolean;
};

type MaybeAdminToken = AdminToken | null;

/**
 * @gqlContext
 */
export function maybeAdminToken(ctx: Ctx): MaybeAdminToken {
  if (ctx.isAdmin) {
    return "AdminToken" as AdminToken;
  }
  return null;
}

/** @gqlQueryField */
export function someField(admin: MaybeAdminToken): string | null {
  // TypeScript ensures we somehow handle the case where `admin` is null before
  // calling into the data layer.
  if (admin == null) {
    return null;
  }
  return someDataLayerFunction(admin);
}

function someDataLayerFunction(_admin: AdminToken) {
  return "Here is your data";
}
```
