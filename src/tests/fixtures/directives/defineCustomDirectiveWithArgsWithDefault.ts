/**
 * This is my custom directive.
 * @gqlDirective
 * @on FIELD_DEFINITION
 */
export function customDirective({ someArg = "Hello" }: { someArg: string }) {}
