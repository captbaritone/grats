# directives/defineCustomDirectiveDuplicateName.invalid.ts

## Input

```ts title="directives/defineCustomDirectiveDuplicateName.invalid.ts"
/**
 * @gqlDirective myDirective on FIELD_DEFINITION
 */
export function a() {}

/**
 * @gqlDirective myDirective on FIELD_DEFINITION
 */
export function b() {}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/defineCustomDirectiveDuplicateName.invalid.ts:2:18 - error: There can be only one directive named "@myDirective".

2  * @gqlDirective myDirective on FIELD_DEFINITION
                   ~~~~~~~~~~~

  src/tests/fixtures/directives/defineCustomDirectiveDuplicateName.invalid.ts:7:18
    7  * @gqlDirective myDirective on FIELD_DEFINITION
                       ~~~~~~~~~~~
    Related location
```