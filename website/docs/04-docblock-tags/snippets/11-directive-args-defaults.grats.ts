/**
 * @gqlDirective on FIELD_DEFINITION
 */
function myDirective({ greeting = "Hello" }: { greeting: string }) {}
