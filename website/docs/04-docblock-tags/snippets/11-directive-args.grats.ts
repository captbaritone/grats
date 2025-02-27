// trim-start
type SomeType = any;
// trim-end
/**
 * @gqlDirective on FIELD_DEFINITION
 */
function myDirective(args: { someArg: string }, someNonGqlArg: SomeType) {}
