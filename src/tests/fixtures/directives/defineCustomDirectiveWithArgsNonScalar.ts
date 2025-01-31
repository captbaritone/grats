/** @gqlInput */
type SomeInput = {
  someField: string;
};

/**
 * This is my custom directive.
 * @gqlDirective
 * @on FIELD_DEFINITION
 */
export function customDirective(args: { someArg: SomeInput }) {}
