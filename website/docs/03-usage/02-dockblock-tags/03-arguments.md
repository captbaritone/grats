# Arguments

If you wish to define arguments for a field, define your argument types inline:

```ts
/** @gqlField */
// highlight-start
myField(args: { greeting: string }): string {
// highlight-end
  return `${args.greeting} World`;
}
```

Default values for arguments can be defined by using the `=` operator with destructuring:

```ts
/** @gqlField */
myField({ greeting = "Hello" }: { greeting: string }): string {
  return `${greeting} World`;
}
```

```ts
/** @gqlField */
myField({ greeting = { salutation: "Sup" } }: { greeting: GreetingConfig }): string {
  return `${greeting.salutation} World`;
}
```
