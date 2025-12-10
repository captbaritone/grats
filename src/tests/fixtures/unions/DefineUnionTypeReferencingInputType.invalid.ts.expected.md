## input

```ts title="unions/DefineUnionTypeReferencingInputType.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  me: Actor;
}

/** @gqlType */
class User {
  /** @gqlField */
  name: string;
}

/** @gqlInput */
type Entity = {
  description: string;
};

/** @gqlUnion */
type Actor = User | Entity;
```

## Output

```
src/tests/fixtures/unions/DefineUnionTypeReferencingInputType.invalid.ts:19:21 - error: Union type Actor can only include Object types, it cannot include Entity.

19 type Actor = User | Entity;
                       ~~~~~~
```