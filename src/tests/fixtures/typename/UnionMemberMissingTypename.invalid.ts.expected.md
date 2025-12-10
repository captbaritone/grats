## input

```ts title="typename/UnionMemberMissingTypename.invalid.ts"
/** @gqlType */
class User {
  /** @gqlField */
  name: string = "Alice";
}

/** @gqlType */
class Group {
  /** @gqlField */
  name: string = "Alice Fan Club";
}

/** @gqlUnion */
export type MyUnion = User | Group;
```

## Output

```
src/tests/fixtures/typename/UnionMemberMissingTypename.invalid.ts:8:7 - error: Cannot resolve typename. The type `Group` is a member of `MyUnion`, so it must either have a `__typename` property or be an exported class.

8 class Group {
        ~~~~~

  src/tests/fixtures/typename/UnionMemberMissingTypename.invalid.ts:14:13
    14 export type MyUnion = User | Group;
                   ~~~~~~~
    MyUnion is defined here:
src/tests/fixtures/typename/UnionMemberMissingTypename.invalid.ts:2:7 - error: Cannot resolve typename. The type `User` is a member of `MyUnion`, so it must either have a `__typename` property or be an exported class.

2 class User {
        ~~~~

  src/tests/fixtures/typename/UnionMemberMissingTypename.invalid.ts:14:13
    14 export type MyUnion = User | Group;
                   ~~~~~~~
    MyUnion is defined here:
```