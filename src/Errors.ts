import {
  ALL_TAGS,
  ENUM_TAG,
  FIELD_TAG,
  IMPLEMENTS_TAG_DEPRECATED,
  INPUT_TAG,
  INTERFACE_TAG,
  KILLS_PARENT_ON_EXCEPTION_TAG,
  LIBRARY_IMPORT_NAME,
  SCALAR_TAG,
  TYPE_TAG,
  UNION_TAG,
} from "./Extractor";

export const ISSUE_URL = "https://github.com/captbaritone/grats/issues";

// TODO: Move these to short URLS that are easier to keep from breaking.
const DOC_URLS = {
  mergedInterfaces:
    "https://grats.capt.dev/docs/docblock-tags/interfaces/#merged-interfaces",
  parameterProperties:
    "https://grats.capt.dev/docs/docblock-tags/fields#class-based-fields",
  commentSyntax: "https://grats.capt.dev/docs/getting-started/comment-syntax",
};

/**
 * Error messages for Grats
 *
 * Ideally each error message conveys all of the following:
 * - What went wrong
 * - What Grats expected with an example
 * - Why Grats expected that
 * - A suggestion for how to fix the error
 * - A link to the Grats documentation
 */

export function fieldTagOnWrongNode() {
  return `\`@${FIELD_TAG}\` can only be used on method/property declarations, signatures, or function declarations.`;
}
export function killsParentOnExceptionOnWrongNode() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\`. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` can only be used in field annotation docblocks. Perhaps you are missing a \`@${FIELD_TAG}\` tag?`;
}

export function wrongCasingForGratsTag(actual: string, expected: string) {
  return `Incorrect casing for Grats tag \`@${actual}\`. Use \`@${expected}\` instead.`;
}

export function invalidGratsTag(actual: string) {
  const validTagList = ALL_TAGS.map((t) => `\`@${t}\``).join(", ");
  return `\`@${actual}\` is not a valid Grats tag. Valid tags are: ${validTagList}.`;
}

export function invalidTypeTagUsage() {
  return `\`@${TYPE_TAG}\` can only be used on class, interface or type declarations. e.g. \`class MyType {}\``;
}

export function invalidScalarTagUsage() {
  return `\`@${SCALAR_TAG}\` can only be used on type alias declarations. e.g. \`type MyScalar = string\``;
}

export function invalidInterfaceTagUsage() {
  return `\`@${INTERFACE_TAG}\` can only be used on interface declarations. e.g. \`interface MyInterface {}\``;
}

export function invalidEnumTagUsage() {
  return `\`@${ENUM_TAG}\` can only be used on enum declarations or TypeScript unions. e.g. \`enum MyEnum {}\` or \`type MyEnum = "foo" | "bar"\``;
}

export function invalidInputTagUsage() {
  return `\`@${INPUT_TAG}\` can only be used on type alias or interface declarations. e.g. \`type MyInput = { foo: string }\` or \`interface MyInput { foo: string }\``;
}

export function invalidUnionTagUsage() {
  return `\`@${UNION_TAG}\` can only be used on type alias declarations. e.g. \`type MyUnion = TypeA | TypeB\``;
}

export function expectedUnionTypeNode() {
  return `Expected a TypeScript union. \`@${UNION_TAG}\` can only be used on TypeScript unions. e.g. \`type MyUnion = TypeA | TypeB\``;
}

export function expectedUnionTypeReference() {
  return `Expected \`@${UNION_TAG}\` union members to be type references. Grats expects union members to be references to something annotated with \`@gqlType\`.`;
}

export function invalidParentArgForFunctionField() {
  return `Expected \`@${FIELD_TAG}\` function to have a first argument representing the type to extend. If you don't need access to the parent object in the function, you can name the variable \`_\` to indicate that it is unused. e.g. \`function myField(_: ParentType) {}\``;
}

export function invalidReturnTypeForFunctionField() {
  return 'Expected GraphQL field to have an explicit return type. This is needed to allow Grats to "see" the type of the field.';
}

export function functionFieldNotTopLevel() {
  return `Expected \`@${FIELD_TAG}\` function to be a top-level declaration. Grats needs to import resolver functions into it's generated schema module, so the resolver function must be an exported.`;
}

const FUNCTION_PARENT_TYPE_CONTEXT = `Grats treats the first argument as the parent object of the field. Therefore Grats needs to see the _type_ of the first argument in order to know to which type/interface this field should be added.`;

export function functionFieldParentTypeMissing() {
  return `Expected first argument of a \`@${FIELD_TAG}\` function to have an explicit type annotation. ${FUNCTION_PARENT_TYPE_CONTEXT}`;
}

export function functionFieldParentTypeNotValid() {
  return `Expected first argument of a \`@${FIELD_TAG}\` function to be typed as a type reference. ${FUNCTION_PARENT_TYPE_CONTEXT}`;
}

export function functionFieldNotNamed() {
  return `Expected \`@${FIELD_TAG}\` function to be named. Grats uses the name of the function to derive the name of the GraphQL field. Additionally, Grats needs to import resolver functions into it's generated schema module, so the resolver function must be a named export.`;
}

export function functionFieldDefaultExport() {
  return `Expected a \`@${FIELD_TAG}\` function to be a named export, not a default export. Grats needs to import resolver functions into it's generated schema module, so the resolver function must be a named export.`;
}

export function functionFieldNotNamedExport() {
  return `Expected a \`@${FIELD_TAG}\` function to be a named export. Grats needs to import resolver functions into it's generated schema module, so the resolver function must be a named export.`;
}

export function inputTypeNotLiteral() {
  return `\`@${INPUT_TAG}\` can only be used on type literals. e.g. \`type MyInput = { foo: string }\``;
}

export function inputTypeFieldNotProperty() {
  return `\`@${INPUT_TAG}\` types only support property signature members. e.g. \`type MyInput = { foo: string }\``;
}

export function inputInterfaceFieldNotProperty() {
  return `\`@${INPUT_TAG}\` interfaces only support property signature members. e.g. \`interface MyInput { foo: string }\``;
}

export function inputFieldUntyped() {
  return 'Input field must have an explicit type annotation. Grats uses the type annotation to determine the type of the field, so it must be explicit in order for Grats to "see" the type.';
}

export function typeTagOnUnnamedClass() {
  return `Unexpected \`@${TYPE_TAG}\` annotation on unnamed class declaration. Grats uses the name of the class to derive the name of the GraphQL type. Consider naming the class.`;
}

export function typeTagOnAliasOfNonObjectOrUnknown() {
  return `Expected \`@${TYPE_TAG}\` type to be an object type literal (\`{ }\`) or \`unknown\`. For example: \`type Foo = { bar: string }\` or \`type Query = unknown\`.`;
}

export function typeNameNotDeclaration() {
  return `Expected \`__typename\` to be a property declaration. For example: \`__typename: "MyType"\`.`;
}

const TYPENAME_CONTEXT =
  "This lets Grats know that the GraphQL executor will be able to derive the type of the object at runtime.";

export function typeNameMissingInitializer() {
  return `Expected \`__typename\` property to have an initializer or a string literal type. For example: \`__typename = "MyType"\` or \`__typename: "MyType";\`. ${TYPENAME_CONTEXT}`;
}

export function typeNameInitializeNotString() {
  return `Expected \`__typename\` property initializer to be a string literal. For example: \`__typename = "MyType"\` or \`__typename: "MyType";\`. ${TYPENAME_CONTEXT}`;
}

export function typeNameInitializerWrong(expected: string, actual: string) {
  return `Expected \`__typename\` property initializer to be \`"${expected}"\`, found \`"${actual}"\`. ${TYPENAME_CONTEXT}`;
}

export function typeNameMissingTypeAnnotation(expected: string) {
  return `Expected \`__typename\` property signature to specify the typename as a string literal string type. For example \`__typename: "${expected}";\`. ${TYPENAME_CONTEXT}`;
}

export function typeNameTypeNotStringLiteral(expected: string) {
  return `Expected \`__typename\` property signature to specify the typename as a string literal string type. For example \`__typename: "${expected}";\`. ${TYPENAME_CONTEXT}`;
}

export function typeNameDoesNotMatchExpected(expected: string) {
  return `Expected \`__typename\` property to be \`"${expected}"\`. ${TYPENAME_CONTEXT}`;
}

export function argumentParamIsMissingType() {
  return "Expected GraphQL field arguments to have an explicit type annotation. If there are no arguments, you can use `args: unknown`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.";
}

export function argumentParamIsNotObject() {
  return "Expected GraphQL field arguments to be typed using an inline literal object: `{someField: string}`. If there are no arguments, you can use `args: unknown`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.";
}

export function argIsNotProperty() {
  return "Expected GraphQL field argument type to be a property signature. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.";
}

export function argNameNotLiteral() {
  return "Expected GraphQL field argument names to be a literal. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.";
}

export function argNotTyped() {
  return "Expected GraphQL field argument to have an explicit type annotation. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.";
}

export function enumTagOnInvalidNode() {
  return `Expected \`@${ENUM_TAG}\` to be a union type, or a string literal in the edge case of a single value enum. For example: \`type MyEnum = "foo" | "bar"\` or \`type MyEnum = "foo"\`.`;
}

export function enumVariantNotStringLiteral() {
  return `Expected \`@${ENUM_TAG}\` enum members to be string literal types. For example: \`'foo'\`. Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.`;
}

export function enumVariantMissingInitializer() {
  return `Expected \`@${ENUM_TAG}\` enum members to have string literal initializers. For example: \`FOO = 'foo'\`. In GraphQL enum values are strings, and Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.`;
}

export function gqlEntityMissingName() {
  return "Expected GraphQL entity to have a name. Grats uses the name of the entity to derive the name of the GraphQL construct.";
}

export function methodMissingType() {
  return "Expected GraphQL field methods to have an explicitly defined return type. Grats needs to be able to see the type of the field to generate its type in the GraphQL schema.";
}

export function wrapperMissingTypeArg() {
  return `Expected wrapper type reference to have type arguments. Grats needs to be able to see the return type in order to generate a GraphQL schema.`;
}

export function invalidWrapperOnInputType(wrapperName: string) {
  return `Invalid input type. \`${wrapperName}\` is not a valid type when used as a GraphQL input value.`;
}

export function cannotResolveSymbolForDescription() {
  return "Expected TypeScript to be able to resolve this GraphQL entity to a symbol. Is it possible that this type is not defined in this file? Grats needs to follow type references to their declaration in order to determine which GraphQL name is being referenced.";
}

export function propertyFieldMissingType() {
  return "Expected GraphQL field to have an explicitly defined type annotation. Grats needs to be able to see the type of the field to generate a field's type in the GraphQL schema.";
}

export function expectedOneNonNullishType() {
  return `Expected exactly one non-nullish type. GraphQL does not support fields returning an arbitrary union of types. Consider defining an explicit \`@${UNION_TAG}\` union type and returning that.`;
}

export function ambiguousNumberType() {
  return `Unexpected number type. GraphQL supports both Int and Float, making \`number\` ambiguous. Instead, import the \`Int\` or \`Float\` type from \`${LIBRARY_IMPORT_NAME}\` and use that. e.g. \`import { Int, Float } from "${LIBRARY_IMPORT_NAME}";\`.`;
}

export function defaultValueIsNotLiteral() {
  return 'Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.';
}

export function defaultArgElementIsNotAssignment() {
  return "Expected property to be a default assignment. For example: `{ first = 10}`. Grats needs to extract a literal GraphQL value here, and that requires Grats being able to see the literal value in the source code.";
}

export function defaultArgPropertyMissingName() {
  return "Expected object literal property to have a name. Grats needs to extract a literal value here, and that requires Grats being able to see the literal value and its field name in the source code.";
}

export function defaultArgPropertyMissingInitializer() {
  return "Expected object literal property to have an initializer. For example: `{ offset = 10}`. Grats needs to extract a literal GraphQL value here, and that requires Grats being able to see the literal value in the source code.";
}

export function unsupportedTypeLiteral() {
  return `Unexpected type literal. Grats expects types in GraphQL positions to be scalar types, or reference a named GraphQL type directly. You may want to define a named GraphQL type elsewhere and reference it here.`;
}

export function unknownGraphQLType() {
  return `Unknown GraphQL type. Grats doe not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.`;
}

export function pluralTypeMissingParameter() {
  return `Expected wrapper type reference to have type arguments. Grats needs to be able to see the return type in order to generate a GraphQL schema.`;
}

export function expectedNameIdentifier() {
  return "Expected an name identifier. Grats expected to find a name here which it could use to derive the GraphQL name.";
}

export function killsParentOnExceptionWithWrongConfig() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` tag. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` is only supported when the Grats config option \`nullableByDefault\` is enabled in your \`tsconfig.json\`.`;
}

export function killsParentOnExceptionOnNullable() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` tag on field typed as nullable. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` will force a field to appear as non-nullable in the schema, so it's implementation must also be non-nullable. .`;
}

export function nonNullTypeCannotBeOptional() {
  return `Unexpected optional argument that does not also accept \`null\`. Optional arguments in GraphQL may get passed an explicit \`null\` value by the GraphQL executor. This means optional arguments must be typed to also accept \`null\`. Consider adding \`| null\` to the end of the argument type.`;
}

export function mergedInterfaces() {
  return [
    `Unexpected merged interface.`,
    `If an interface is declared multiple times in a scope, TypeScript merges them.`,
    `To avoid ambiguity Grats does not support using merged interfaces as GraphQL definitions.`,
    `Consider using a unique name for your TypeScript interface and renaming it.\n\n`,
    `Learn more: ${DOC_URLS.mergedInterfaces}`,
  ].join(" ");
}

export function implementsTagOnClass() {
  return `\`@${IMPLEMENTS_TAG_DEPRECATED}\` has been deprecated. Instead use \`class MyType implements MyInterface\`.`;
}

export function implementsTagOnInterface() {
  return `\`@${IMPLEMENTS_TAG_DEPRECATED}\` has been deprecated. Instead use \`interface MyType extends MyInterface\`.`;
}

export function implementsTagOnTypeAlias() {
  return `\`@${IMPLEMENTS_TAG_DEPRECATED}\` has been deprecated. Types which implement GraphQL interfaces should be defined using TypeScript class or interface declarations.`;
}

export function duplicateTag(tagName: string) {
  return `Unexpected duplicate \`@${tagName}\` tag. Grats does not accept multiple instances of the same tag.`;
}

export function duplicateInterfaceTag() {
  return `Unexpected duplicate \`@${IMPLEMENTS_TAG_DEPRECATED}\` tag. To declare that a type or interface implements multiple interfaces list them as comma separated values: \`@${IMPLEMENTS_TAG_DEPRECATED} interfaceA, interfaceB\`.`;
}

export function parameterWithoutModifiers() {
  return [
    `Expected \`@${FIELD_TAG}\` constructor parameter to be a parameter property. This requires a modifier such as \`public\` or \`readonly\` before the parameter name.\n\n`,
    `Learn more: ${DOC_URLS.parameterProperties}`,
  ].join("");
}

export function parameterPropertyNotPublic() {
  return [
    `Expected \`@${FIELD_TAG}\` parameter property to be public. Valid modifiers for \`@${FIELD_TAG}\` parameter properties are  \`public\` and \`readonly\`.\n\n`,
    `Learn more: ${DOC_URLS.parameterProperties}`,
  ].join("");
}

export function parameterPropertyMissingType() {
  return `Expected \`@${FIELD_TAG}\` parameter property to have an explicit type annotation. Grats needs to be able to see the type of the parameter property to generate a GraphQL schema.`;
}

export function invalidTypePassedToFieldFunction() {
  return `Unexpected type passed to \`@${FIELD_TAG}\` function. \`@${FIELD_TAG}\` functions can only be used to extend \`@${TYPE_TAG}\` and \`@${INTERFACE_TAG}\` types.`;
}

export function unresolvedTypeReference() {
  return "Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?";
}

export function expectedTypeAnnotationOnContext() {
  return "Expected context parameter to have an explicit type annotation. Grats validates that your context parameter is type-safe by checking that all context values reference the same type declaration.";
}

export function expectedTypeAnnotationOfReferenceOnContext() {
  return "Expected context parameter's type to be a type reference. Grats validates that your context parameter is type-safe by checking that all context values reference the same type declaration.";
}

export function expectedTypeAnnotationOnContextToBeResolvable() {
  // TODO: Provide guidance?
  // TODO: I don't think we have a test case that triggers this error.
  return "Unable to resolve context parameter type. Grats validates that your context parameter is type-safe by checking that all context values reference the same type declaration.";
}

export function expectedTypeAnnotationOnContextToHaveDeclaration() {
  return "Unable to locate the declaration of the context parameter's type. Grats validates that your context parameter is type-safe by checking all context values reference the same type declaration. Did you forget to import or define this type?";
}

export function unexpectedParamSpreadForContextParam() {
  return "Unexpected spread parameter in context parameter position. Grats expects the context parameter to be a single, explicitly-typed argument.";
}

export function multipleContextTypes() {
  return "Context argument's type does not match. Grats expects all resolvers that read the context argument to use the same type for that argument. Did you use the incorrect type in one of your resolvers?";
}

export function graphQLNameHasLeadingNewlines(
  name: string,
  tagName: string,
): string {
  return `Expected the GraphQL name \`${name}\` to be on the same line as it's \`@${tagName}\` tag.`;
}

export function graphQLTagNameHasWhitespace(tagName: string): string {
  return `Expected text following a \`@${tagName}\` tag to be a GraphQL name. If you intended this text to be a description, place it at the top of the docblock before any \`@tags\`.`;
}

export function subscriptionFieldNotAsyncIterable() {
  return "Expected fields on `Subscription` to return an `AsyncIterable`. Fields on `Subscription` model a subscription, which is a stream of events. Grats expects fields on `Subscription` to return an `AsyncIterable` which can be used to model this stream.";
}

export function operationTypeNotUnknown() {
  return "Operation types `Query`, `Mutation`, and `Subscription` must be defined as type aliases of `unknown`. E.g. `type Query = unknown`. This is because GraphQL servers do not have an agreed upon way to produce root values, and Grats errs on the side of safety. If you are trying to implement dependency injection, consider using the `context` argument passed to each resolver instead. If you have a strong use case for a concrete root value, please file an issue.";
}

export function expectedNullableArgumentToBeOptional() {
  return "Expected nullable argument to _also_ be optional (`?`). graphql-js may omit properties on the argument object where an undefined GraphQL variable is passed, or if the argument is omitted in the operation text. To ensure your resolver is capable of handing this scenario, add a `?` to the end of the argument name to make it optional. e.g. `{greeting?: string | null}`";
}

export function gqlTagInLineComment() {
  return `Unexpected Grats tag in line (\`//\`) comment. Grats looks for tags in JSDoc-style block comments. e.g. \`/** @gqlType */\`. For more information see: ${DOC_URLS.commentSyntax}`;
}

export function gqlTagInNonJSDocBlockComment() {
  return `Unexpected Grats tag in non-JSDoc-style block comment. Grats only looks for tags in JSDoc-style block comments which start with \`/**\`. For more information see: ${DOC_URLS.commentSyntax}`;
}

export function gqlTagInDetachedJSDocBlockComment() {
  return `Unexpected Grats tag in detached docblock. Grats was unable to determine which TypeScript declaration this docblock is associated with. Moving the docblock to a position with is unambiguously "above" the relevant declaration may help. For more information see: ${DOC_URLS.commentSyntax}`;
}

export function gqlFieldTagOnInputType() {
  return `The tag \`@${FIELD_TAG}\` is not needed on fields of input types. All fields are automatically included as part of the input type. This tag can be safely removed.`;
}

export function gqlFieldParentMissingTag() {
  return `Unexpected \`@${FIELD_TAG}\`. The parent construct must be either a \`@${TYPE_TAG}\` or \`@${INTERFACE_TAG}\` tag. Are you missing one of these tags?`;
}
