# fieldDirective/index.ts

## Input

```ts title="fieldDirective/index.ts"
import { Int, FieldDirective } from "../../../Types.js";
import { GraphQLFieldResolver } from "graphql";

const log: string[] = [];

/**
 * Logs field access before resolving.
 * @gqlDirective on FIELD_DEFINITION
 */
export function logged(args: { label: string }): FieldDirective {
  return (next: GraphQLFieldResolver<unknown, unknown>) =>
    (source, resolverArgs, context, info) => {
      log.push(args.label);
      return next(source, resolverArgs, context, info);
    };
}

/**
 * Uppercases the result of a string field.
 * @gqlDirective on FIELD_DEFINITION
 */
export function uppercased(args: { enabled: boolean }): FieldDirective {
  return (next: GraphQLFieldResolver<unknown, unknown>) =>
    (source, resolverArgs, context, info) => {
      const result = next(source, resolverArgs, context, info);
      return args.enabled ? String(result).toUpperCase() : result;
    };
}

/**
 * @gqlQueryField
 * @gqlAnnotate logged(label: "greeting")
 * @gqlAnnotate uppercased(enabled: true)
 */
export function greeting(): string {
  return "hi";
}

/**
 * Returns the log of directive invocations.
 * @gqlQueryField
 */
export function getLog(): string[] {
  return log;
}

export const query = `
  query {
    greeting
    getLog
  }
`;
```

## Output

### Query Result

```json
{
  "data": {
    "greeting": "HI",
    "getLog": [
      "greeting"
    ]
  }
}
```