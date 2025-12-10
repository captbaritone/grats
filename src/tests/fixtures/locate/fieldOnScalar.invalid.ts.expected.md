## input

```ts title="locate/fieldOnScalar.invalid.ts"
// Locate: Date.name
/** @gqlScalar */
export type Date = string;
```

## Output

### Error Locating Type

```text
Cannot locate field `name` on type `Date`. Only object types, interfaces, and input objects have fields.
```