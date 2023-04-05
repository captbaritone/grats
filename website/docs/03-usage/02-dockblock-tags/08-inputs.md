# Inputs

GraphQL input types can be defined by placing a `@gqlInput` docblock directly before a:

* Type alias declaration

```ts
/** 
 * Description of my input type
 * @gqlInput <optional name of the input, if different from type name>
 */
type MyInput = {
  name: string;
  age: number;
};
```

Unlike with fields, every property of an input type is automatically included as part of the GraphQL definition. You do not need to annotate individual properties with `@gqlField`.