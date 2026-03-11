# locate/fieldOnScalar.invalid.ts

## Input

```ts title="locate/fieldOnScalar.invalid.ts"
// Locate: Date.name
/** @gqlScalar */
export type Date = string;
```

## Output

### Error Locating Type

```text
Invalid schema coordinate: `Date.name`. Expected "Date" to be an Enum, Input Object, Object or Interface type.
```