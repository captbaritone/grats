import { Int, FieldDirective } from "../../../Types";

/**
 * Limits the rate of field resolution.
 * @gqlDirective on FIELD_DEFINITION
 */
export function rateLimit(args: { max: Int }): FieldDirective {
  return (next) => (source, args, context, info) => {
    return next(source, args, context, info);
  };
}

/** @gqlType */
type Query = unknown;

/**
 * All likes in the system.
 * @gqlField
 * @gqlAnnotate rateLimit(max: 10)
 */
export function likes(_: Query): string {
  return "hello";
}
