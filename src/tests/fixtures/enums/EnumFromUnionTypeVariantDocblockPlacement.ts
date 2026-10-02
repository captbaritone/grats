/** @gqlEnum */
type WithLeadingPipe =
  /** Before the pipe. */
  | "BEFORE"
  | /** After the pipe. */ "AFTER"
  /** First docblock, which is ignored. */
  /** Last docblock. */
  | "LAST";

/** @gqlEnum */
type WithoutLeadingPipe = /** The first member. */ "FIRST" | "SECOND";

/** @gqlType */
export class SomeType {
  /** @gqlField */
  withLeadingPipe: WithLeadingPipe;
  /** @gqlField */
  withoutLeadingPipe: WithoutLeadingPipe;
}
