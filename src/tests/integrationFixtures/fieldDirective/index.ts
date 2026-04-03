import { Int, FieldDirective } from "../../../Types.js";

const log: string[] = [];

/**
 * Logs field access before resolving.
 * @gqlDirective on FIELD_DEFINITION
 */
export function logged(args: { label: string }): FieldDirective {
  return (next) => (source, resolverArgs, context, info) => {
    log.push(args.label);
    return next(source, resolverArgs, context, info);
  };
}

/**
 * Uppercases the result of a string field.
 * @gqlDirective on FIELD_DEFINITION
 */
export function uppercased(args: { enabled: boolean }): FieldDirective {
  return (next) => (source, resolverArgs, context, info) => {
    const result = next(source, resolverArgs, context, info);
    return args.enabled ? String(result).toUpperCase() : result;
  };
}

/** @gqlType */
type Query = unknown;

/**
 * @gqlField
 * @gqlAnnotate logged(label: "greeting")
 * @gqlAnnotate uppercased(enabled: true)
 */
export function greeting(_: Query): string {
  return "hi";
}

/**
 * Returns the log of directive invocations.
 * @gqlField
 */
export function getLog(_: Query): string[] {
  return log;
}

export const query = `
  query {
    greeting
    getLog
  }
`;
