# directives/defineCustomDirectiveLocationInvalid.invalid.ts

## Input

```ts title="directives/defineCustomDirectiveLocationInvalid.invalid.ts"
/**
 * This is my custom directive.
 * @gqlDirective on WHOOPS
 */
export function customDirective() {}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/defineCustomDirectiveLocationInvalid.invalid.ts:3:4 - error: "WHOOPS" is not a valid directive location. Valid locations are: QUERY, MUTATION, SUBSCRIPTION, FIELD, FRAGMENT_DEFINITION, FRAGMENT_SPREAD, INLINE_FRAGMENT, VARIABLE_DEFINITION, SCHEMA, SCALAR, OBJECT, FIELD_DEFINITION, ARGUMENT_DEFINITION, INTERFACE, UNION, ENUM, ENUM_VALUE, INPUT_OBJECT, INPUT_FIELD_DEFINITION.

3  * @gqlDirective on WHOOPS
     ~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
```