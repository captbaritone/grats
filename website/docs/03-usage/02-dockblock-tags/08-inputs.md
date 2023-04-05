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