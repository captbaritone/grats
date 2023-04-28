import {
  ALL_TAGS,
  ENUM_TAG,
  FIELD_TAG,
  IMPLEMENTS_TAG,
  INPUT_TAG,
  INTERFACE_TAG,
  KILLS_PARENT_ON_EXCEPTION_TAG,
  LIBRARY_IMPORT_NAME,
  SCALAR_TAG,
  TYPE_TAG,
  UNION_TAG,
} from "./Extractor";

// TODO: Move these to short URLS that are easier to keep from breaking.
const DOC_URLS = {
  mergedInterfaces:
    "https://grats.capt.dev/docs/dockblock-tags/interfaces/#merged-interfaces",
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
  return `\`@${FIELD_TAG}\` can only be used on method/property declarations or signatures.`;
}

export function implementsTagOnWrongNode() {
  return `\`@${IMPLEMENTS_TAG}\` can only be used on Grats type or interface declarations. Did you mean to include the \`@${TYPE_TAG}\` or \`@${INTERFACE_TAG}\` tag in this docblock?`;
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
  return `\`@${TYPE_TAG}\` can only be used on class or interface declarations.`;
}

export function invalidScalarTagUsage() {
  return `\`@${SCALAR_TAG}\` can only be used on type alias declarations.`;
}

export function invalidInterfaceTagUsage() {
  return `\`@${INTERFACE_TAG}\` can only be used on interface declarations.`;
}

export function invalidEnumTagUsage() {
  return `\`@${ENUM_TAG}\` can only be used on enum declarations or TypeScript unions.`;
}

export function invalidInputTagUsage() {
  return `\`@${INPUT_TAG}\` can only be used on type alias declarations.`;
}

export function invalidUnionTagUsage() {
  return `\`@${UNION_TAG}\` can only be used on type alias declarations.`;
}

export function expectedUnionTypeNode() {
  return `Expected a TypeScript union. \`@${UNION_TAG}\` can only be used on TypeScript unions.`;
}

export function expectedUnionTypeReference() {
  return `Expected \`@${UNION_TAG}\` union members to be type references.`;
}

export function invalidParentArgForFunctionField() {
  return `Expected \`@${FIELD_TAG}\` function to have a first argument representing the type to extend.`;
}

export function invalidReturnTypeForFunctionField() {
  return "Expected GraphQL field to have an explicit return type.";
}

export function functionFieldNotTopLevel() {
  return `Expected \`@${FIELD_TAG}\` function to be a top-level declaration.`;
}

export function functionFieldParentTypeMissing() {
  return `Expected first argument of a \`@${FIELD_TAG}\` function to have an explicit type annotation.`;
}

export function functionFieldParentTypeNotValid() {
  return `Expected first argument of a \`@${FIELD_TAG}\` function to be typed as a \`@${TYPE_TAG}\` type.`;
}

export function functionFieldNotNamed() {
  return `Expected \`@${FIELD_TAG}\` function to be named.`;
}

export function functionFieldDefaultExport() {
  return `Expected a \`@${FIELD_TAG}\` function to be a named export, not a default export.`;
}

export function functionFieldNotNamedExport() {
  return `Expected a \`@${FIELD_TAG}\` function to be a named export.`;
}

export function inputTypeNotLiteral() {
  return `\`@${INPUT_TAG}\` can only be used on type literals.`;
}

export function inputTypeFieldNotProperty() {
  return `\`@${INPUT_TAG}\` types only support property signature members.`;
}

export function inputFieldUntyped() {
  return "Input field must have a type annotation.";
}

export function typeTagOnUnamedClass() {
  return `Unexpected \`@${TYPE_TAG}\` annotation on unnamed class declaration.`;
}

export function typeTagOnAliasOfNonObject() {
  return `Expected \`@${TYPE_TAG}\` type to be a type literal. For example: \`type Foo = { bar: string }\``;
}

export function typeNameNotDeclaration() {
  return `Expected \`__typename\` to be a property declaration.`;
}

export function typeNameMissingInitializer() {
  return `Expected \`__typename\` property to have an initializer or a string literal type. For example: \`__typename = "MyType"\` or \`__typename: "MyType";\`.`;
}

export function typeNameInitializeNotString() {
  return `Expected \`__typename\` property initializer to be a string literal. For example: \`__typename = "MyType"\` or \`__typename: "MyType";\`.`;
}

export function typeNameInitializerWrong(expected: string, actual: string) {
  return `Expected \`__typename\` property initializer to be \`"${expected}"\`, found \`"${actual}"\`.`;
}

export function typeNameMissingTypeAnnotation(expected: string) {
  return `Expected \`__typename\` property signature to specify the typename as a string literal string type. For example \`__typename: "${expected}";\``;
}

export function typeNameTypeNotStringLiteral(expected: string) {
  return `Expected \`__typename\` property signature to specify the typename as a string literal string type. For example \`__typename: "${expected}";\``;
}

export function typeNameDoesNotMatchExpected(expected: string) {
  return `Expected \`__typename\` property to be \`"${expected}"\``;
}

export function argumentParamIsMissingType() {
  return "Expected GraphQL field arguments to have a TypeScript type. If there are no arguments, you can use `args: never`.";
}

export function argumentParamIsNotObject() {
  return "Expected GraphQL field arguments to be typed using a literal object: `{someField: string}`.";
}

export function argIsNotProperty() {
  return "Expected GraphQL field argument type to be a property signature.";
}

export function argNameNotLiteral() {
  return "Expected GraphQL field argument names to be a literal.";
}

export function argNotTyped() {
  return "Expected GraphQL field argument to have a type.";
}

export function enumTagOnInvalidNode() {
  return `Expected \`@${ENUM_TAG}\` to be a union type, or a string literal in the edge case of a single value enum.`;
}

export function enumVariantNotStringLiteral() {
  return `Expected \`@${ENUM_TAG}\` enum members to be string literal types. For example: \`'foo'\`.`;
}

export function enumVariantMissingInitializer() {
  return `Expected \`@${ENUM_TAG}\` enum members to have string literal initializers. For example: \`FOO = 'foo'\`.`;
}

export function gqlEntityMissingName() {
  return "Expected GraphQL entity to have a name.";
}

export function methodMissingType() {
  return "Expected GraphQL field to have a type.";
}

export function promiseMissingTypeArg() {
  return `Expected type reference to have type arguments.`;
}

export function cannotResolveSymbolForDescription() {
  return "Expected TypeScript to be able to resolve this GraphQL entity to a symbol.";
}

export function propertyFieldMissingType() {
  return "Expected GraphQL field to have a type.";
}

export function expectedOneNonNullishType() {
  return `Expected exactly one non-nullish type.`;
}

export function ambiguousNumberType() {
  return `Unexpected number type. GraphQL supports both Int and Float, making \`number\` ambiguous. Instead, import the \`Int\` or \`Float\` type from \`${LIBRARY_IMPORT_NAME}\` and use that. e.g. \`import { Int, Float } from "${LIBRARY_IMPORT_NAME}";\`.`;
}

export function defaultValueIsNotLiteral() {
  return "Expected GraphQL field argument default values to be a literal.";
}

export function defaultArgElementIsNotAssignment() {
  return "Expected object literal property to be a property assignment.";
}

export function defaultArgPropertyMissingName() {
  return "Expected object literal property to have a name.";
}

export function defaultArgPropertyMissingInitializer() {
  return "Expected object literal property to have an initializer. For example: `{ offset = 10}`.";
}

export function unsupportedTypeLiteral() {
  return `Unexpected type literal. You may want to define a named GraphQL type elsewhere and reference it here.`;
}

export function unknownGraphQLType() {
  return `Unknown GraphQL type.`;
}

export function pluralTypeMissingParameter() {
  return `Expected type reference to have type arguments.`;
}

export function expectedIdentifer() {
  return "Expected an identifier.";
}

export function killsParentOnExceptionWithWrongConfig() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` tag. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` is only supported when the Grats config \`nullableByDefault\` is enabled.`;
}

export function killsParentOnExceptionOnNullable() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` tag. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` is unnessesary on fields that are already nullable.`;
}

export function nonNullTypeCannotBeOptional() {
  return `Unexpected optional argument that does not also accept \`null\`. Optional arguments in GraphQL may get passed an explict \`null\` value. This means optional arguments must be typed to also accept \`null\`.`;
}

export function mergedInterfaces(interfaceName: string) {
  return [
    `Unexpected merged interface \`${interfaceName}\`.`,
    `If an interface is declared multiple times in a scope, TypeScript merges them.`,
    `To avoid ambiguity Grats does not support using merged interfaces as GraphQL interfaces.`,
    `Consider using a unique name for your TypeScript interface and renaming it.\n\n`,
    `Learn more: ${DOC_URLS.mergedInterfaces}`,
  ].join(" ");
}

export function implementsTagMissingValue() {
  return `Expected \`@${IMPLEMENTS_TAG}\` to be followed by one or more interface names.`;
}

export function duplicateTag(tagName: string) {
  return `Unexpected duplicate \`@${tagName}\` tag. Grats does not accept multiple instances of the same tag.`;
}

export function duplicateInterfaceTag() {
  return `Unexpected duplicate \`@${IMPLEMENTS_TAG}\` tag. To declare that a type or interface implements multiple interfaces list them as comma separated values: \`@${IMPLEMENTS_TAG} interfaceA, interfaceB\`.`;
}
