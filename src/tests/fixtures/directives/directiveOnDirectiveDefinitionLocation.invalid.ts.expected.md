# directives/directiveOnDirectiveDefinitionLocation.invalid.ts

## Input

```ts title="directives/directiveOnDirectiveDefinitionLocation.invalid.ts"
import { Int } from "../../../Types";
/**
 * @gqlDirective on DIRECTIVE_DEFINITION
 * @gqlAnnotate
 */
export function myDirective(args: { credits: Int }) {
  // ...
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/directiveOnDirectiveDefinitionLocation.invalid.ts:3:4 - error: "DIRECTIVE_DEFINITION" is not a valid directive location. Valid locations are: QUERY, MUTATION, SUBSCRIPTION, FIELD, FRAGMENT_DEFINITION, FRAGMENT_SPREAD, INLINE_FRAGMENT, VARIABLE_DEFINITION, SCHEMA, SCALAR, OBJECT, FIELD_DEFINITION, ARGUMENT_DEFINITION, INTERFACE, UNION, ENUM, ENUM_VALUE, INPUT_OBJECT, INPUT_FIELD_DEFINITION.

3  * @gqlDirective on DIRECTIVE_DEFINITION
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
4  * @gqlAnnotate
  ~~~
```