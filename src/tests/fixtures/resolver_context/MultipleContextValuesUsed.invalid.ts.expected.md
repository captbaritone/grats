## input

```ts title="resolver_context/MultipleContextValuesUsed.invalid.ts"
/** @gqlContext */
type GratsContext = {
  greeting: string;
};

/** @gqlContext */
type AlsoGratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: GratsContext): string {
    return ctx.greeting;
  }
  /** @gqlField */
  alsoGreeting(ctx: AlsoGratsContext): string {
    return ctx.greeting;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/resolver_context/MultipleContextValuesUsed.invalid.ts:6:5 - error: Unexpected duplicate `@gqlContext` tag. Only one type in a project may be annotated with the `@gqlContext`.

6 /** @gqlContext */
      ~~~~~~~~~~~~

  src/tests/fixtures/resolver_context/MultipleContextValuesUsed.invalid.ts:1:5
    1 /** @gqlContext */
          ~~~~~~~~~~~~
    `@gqlContext` previously defined here.
```