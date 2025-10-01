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
  CONTEXT_TAG,
  INFO_TAG,
  DIRECTIVE_TAG,
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
  return `\`@${FIELD_TAG}\` can only be used on method/property declarations, signatures, function or static method declarations.`;
}

export function rootFieldTagOnWrongNode(typeName: string) {
  return `\`@gql${typeName}Field\` can only be used on function or static method declarations.`;
}

export function killsParentOnExceptionOnWrongNode() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\`. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` can only be used in field annotation docblocks. Perhaps you are missing a \`@${FIELD_TAG}\` tag?`;
}

export function wrongCasingForGratsTag(actual: string, expected: string) {
  return `Incorrect casing for Grats tag \`@${actual}\`. Use \`@${expected}\` instead.`;
}

// TODO: Add code action
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
  return `\`@${INPUT_TAG}\` can only be used on type alias, interface declarations or type unions. e.g. \`type MyInput = { foo: string }\` or \`interface MyInput { foo: string }\``;
}

export function invalidUnionTagUsage() {
  return `\`@${UNION_TAG}\` can only be used on type alias declarations. e.g. \`type MyUnion = TypeA | TypeB\``;
}

export function expectedUnionTypeNode() {
  return `Expected a TypeScript union. \`@${UNION_TAG}\` can only be used on TypeScript unions or a single type reference. e.g. \`type MyUnion = TypeA | TypeB\` or \`type MyUnion = TypeA\``;
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
  return `Expected \`@${FIELD_TAG}\` function to be a top-level declaration. Grats needs to import resolver functions into its generated schema module, so the resolver function must be an exported.`;
}

export function staticMethodClassNotTopLevel() {
  return `Expected class with a static \`@${FIELD_TAG}\` method to be a top-level declaration. Grats needs to import resolver methods into its generated schema module, so the resolver's class must be an exported.`;
}

export function staticMethodFieldClassNotExported() {
  return `Expected \`@${FIELD_TAG}\` static method's class to be exported. Grats needs to import resolvers into its generated schema module, so the resolver class must be an exported.`;
}

const FUNCTION_PARENT_TYPE_CONTEXT = `Grats treats the first argument as the parent object of the field. Therefore Grats needs to see the _type_ of the first argument in order to know to which type/interface this field should be added.`;

export function functionFieldParentTypeMissing() {
  return `Expected first argument of a \`@${FIELD_TAG}\` function to have an explicit type annotation. ${FUNCTION_PARENT_TYPE_CONTEXT}`;
}

export function functionFieldParentTypeNotValid() {
  return `Expected first argument of a \`@${FIELD_TAG}\` function to be typed as a type reference. ${FUNCTION_PARENT_TYPE_CONTEXT}`;
}

export function functionFieldNotNamed() {
  return `Expected \`@${FIELD_TAG}\` function to be named. Grats uses the name of the function to derive the name of the GraphQL field. Additionally, Grats needs to import resolver functions into its generated schema module, so the resolver function must be a named export.`;
}

export function functionFieldNotNamedExport() {
  return `Expected a \`@${FIELD_TAG}\` function to be a named export. Grats needs to import resolver functions into its generated schema module, so the resolver function must be a named export.`;
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

// TODO: Add code action
export function typeNameNotDeclaration() {
  return `Expected \`__typename\` to be a property declaration. For example: \`__typename: "MyType"\`.`;
}

const TYPENAME_CONTEXT =
  "This is needed to ensure Grats can determine the type of this object during GraphQL execution.";

function _typeNamePropertyExample(expectedName: string): string {
  return `For example: \`__typename = "${expectedName}" as const\` or \`__typename: "${expectedName}";\`.`;
}

export function typeNameMissingInitializer() {
  return `Expected \`__typename\` property to have an initializer or a string literal type.  ${TYPENAME_CONTEXT}`;
}

export function typeNameInitializeNotString(expectedName: string) {
  return `Expected \`__typename\` property initializer to be a string literal. ${_typeNamePropertyExample(
    expectedName,
  )} ${TYPENAME_CONTEXT}`;
}

export function typeNameInitializeNotExpression(expectedName: string) {
  return `Expected \`__typename\` property initializer to be an expression with a const assertion. ${_typeNamePropertyExample(
    expectedName,
  )} ${TYPENAME_CONTEXT}`;
}

export function typeNameTypeNotReferenceNode(expectedName: string) {
  return `Expected \`__typename\` property must be correctly defined. ${_typeNamePropertyExample(
    expectedName,
  )} ${TYPENAME_CONTEXT}`;
}

export function typeNameTypeNameNotIdentifier(expectedName: string) {
  return `Expected \`__typename\` property name must be correctly specified. ${_typeNamePropertyExample(
    expectedName,
  )} ${TYPENAME_CONTEXT}`;
}

export function typeNameTypeNameNotConst(expectedName: string) {
  return `Expected \`__typename\` property type name to be "const". ${_typeNamePropertyExample(
    expectedName,
  )} ${TYPENAME_CONTEXT}`;
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

export function resolverParamIsMissingType() {
  return "Missing type annotation for resolver argument. Expected all resolver arguments to have an explicit type annotation. Grats needs to be able to see the type of the arguments to generate an executable GraphQL schema.";
}

export function multipleResolverTypeLiterals() {
  return "Unexpected multiple resolver parameters typed with an object literal. Grats assumes a resolver parameter typed with object literals describes the GraphQL arguments. Therefore only one such parameter is permitted.";
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

// TODO: Add code action
export function ambiguousNumberType() {
  return `Unexpected number type. GraphQL supports both Int and Float, making \`number\` ambiguous. Instead, import the \`Int\` or \`Float\` type from \`${LIBRARY_IMPORT_NAME}\` and use that. e.g. \`import type { Int, Float } from "${LIBRARY_IMPORT_NAME}";\`.`;
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
  return `Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.`;
}

export function pluralTypeMissingParameter() {
  return `Expected wrapper type reference to have type arguments. Grats needs to be able to see the return type in order to generate a GraphQL schema.`;
}

export function expectedNameIdentifier() {
  return "Expected a name identifier. Grats expected to find a name here which it could use to derive the GraphQL name.";
}

// TODO: Add code action
export function killsParentOnExceptionWithWrongConfig() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` tag. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` is only supported when the Grats config option \`nullableByDefault\` is enabled in your \`tsconfig.json\`.`;
}

// TODO: Add code action
export function killsParentOnExceptionOnNullable() {
  return `Unexpected \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` tag on field typed as nullable. \`@${KILLS_PARENT_ON_EXCEPTION_TAG}\` will force a field to appear as non-nullable in the schema, so its implementation must also be non-nullable. .`;
}

// TODO: Add code action
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

// TODO: Add code action
export function implementsTagOnClass() {
  return `\`@${IMPLEMENTS_TAG_DEPRECATED}\` has been deprecated. Instead use \`class MyType implements MyInterface\`.`;
}

// TODO: Add code action
export function implementsTagOnInterface() {
  return `\`@${IMPLEMENTS_TAG_DEPRECATED}\` has been deprecated. Instead use \`interface MyType extends MyInterface\`.`;
}

export function implementsTagOnTypeAlias() {
  return `\`@${IMPLEMENTS_TAG_DEPRECATED}\` has been deprecated. Types which implement GraphQL interfaces should be defined using TypeScript class or interface declarations.`;
}

// TODO: Add code action
export function duplicateTag(tagName: string) {
  return `Unexpected duplicate \`@${tagName}\` tag. Grats does not accept multiple instances of the same tag.`;
}

export function duplicateInterfaceTag() {
  return `Unexpected duplicate \`@${IMPLEMENTS_TAG_DEPRECATED}\` tag. To declare that a type or interface implements multiple interfaces list them as comma separated values: \`@${IMPLEMENTS_TAG_DEPRECATED} interfaceA, interfaceB\`.`;
}

// TODO: Add code action
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

export function unexpectedParamSpreadForResolverParam() {
  return "Unexpected spread argument in resolver. Grats expects all resolver arguments to be a single, explicitly-typed argument.";
}

export function resolverParamIsUnknown() {
  // TODO: Give guidance that this is a change?
  return "Unexpected `unknown` type for resolver argument. If a resolver argument is not needed by the resolver, it may be omitted.";
}

export function resolverParamIsNever() {
  // TODO: Give guidance that this is a change?
  return "Unexpected `never` type for resolver argument. If a resolver argument is not needed by the resolver, it may be omitted.";
}

export function unexpectedResolverParamType() {
  return "Unexpected type for resolver argument. Resolver arguments must be typed with either an object literal (`{}`) or a reference to a named type.";
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
  return "Expected nullable argument to _also_ be optional (`?`). graphql-js may omit properties on the argument object where an undefined GraphQL variable is passed, or if the argument is omitted in the operation text. To ensure your resolver is capable of handling this scenario, add a `?` to the end of the argument name to make it optional. e.g. `{greeting?: string | null}`";
}

export function gqlTagInLineComment() {
  return `Unexpected Grats tag in line (\`//\`) comment. Grats looks for tags in JSDoc-style block comments. e.g. \`/** @gqlType */\`. For more information see: ${DOC_URLS.commentSyntax}`;
}

export function gqlTagInNonJSDocBlockComment() {
  return `Unexpected Grats tag in non-JSDoc-style block comment. Grats only looks for tags in JSDoc-style block comments which start with \`/**\`. For more information see: ${DOC_URLS.commentSyntax}`;
}

export function gqlTagInDetachedJSDocBlockComment() {
  return `Unexpected Grats tag in detached docblock. Grats was unable to determine which TypeScript declaration this docblock is associated with. Moving the docblock to a position that is unambiguously "above" the relevant declaration may help. For more information see: ${DOC_URLS.commentSyntax}`;
}

export function gqlFieldTagOnInputType() {
  return `The tag \`@${FIELD_TAG}\` is not needed on fields of input types. All fields are automatically included as part of the input type. This tag can be safely removed.`;
}

// TODO: Add code action
export function gqlFieldParentMissingTag() {
  return `Unexpected \`@${FIELD_TAG}\`. The parent construct must be either a \`@${TYPE_TAG}\` or \`@${INTERFACE_TAG}\` tag. Are you missing one of these tags?`;
}

export function missingGenericType(
  templateName: string,
  paramName: string,
): string {
  return `Missing type argument for generic GraphQL type. Expected \`${templateName}\` to be passed a GraphQL type argument for type parameter \`${paramName}\`.`;
}

export function nonGraphQLGenericType(
  templateName: string,
  paramName: string,
): string {
  return `Expected \`${templateName}\` to be passed a GraphQL type argument for type parameter \`${paramName}\`.`;
}

export function genericTypeUsedAsUnionMember(): string {
  return `Unexpected generic type used as union member. Generic type may not currently be used as members of a union. Grats requires that all union members define a \`__typename\` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct \`__typename\` property and thus cannot be used as members of a union.`;
}
export function genericTypeImplementsInterface(): string {
  return `Unexpected \`implements\` on generic \`${TYPE_TAG}\`. Generic types may not currently declare themselves as implementing interfaces. Grats requires that all types which implement an interface define a \`__typename\` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct \`__typename\` property and thus declare themselves as interface implementors.`;
}

export function concreteTypenameImplementingInterfaceCannotBeResolved(
  implementor: string,
  interfaceName: string,
): string {
  return `Cannot resolve typename. The type \`${implementor}\` implements \`${interfaceName}\`, so it must either have a \`__typename\` property or be an exported class.`;
}

export function concreteTypenameInUnionCannotBeResolved(
  implementor: string,
  unionName: string,
): string {
  return `Cannot resolve typename. The type \`${implementor}\` is a member of \`${unionName}\`, so it must either have a \`__typename\` property or be an exported class.`;
}

// TODO: Add code action
export function invalidFieldNonPublicAccessModifier(): string {
  return `Unexpected access modifier on \`@${FIELD_TAG}\` method. GraphQL fields must be able to be called by the GraphQL executor.`;
}

export function invalidStaticModifier(): string {
  return `Unexpected \`static\` modifier on non-method \`@${FIELD_TAG}\`. \`static\` is only valid on method signatures.`;
}

export function staticMethodOnNonClass(): string {
  return `Unexpected \`@${FIELD_TAG}\` \`static\` method on non-class declaration. Static method fields may only be declared on exported class declarations.`;
}

export function staticMethodClassWithNamedExportNotNamed(): string {
  return `Expected \`@${FIELD_TAG}\` static method's class to be named if exported without the \`default\` keyword.`;
}

export function oneOfNotSupportedGraphql(
  requiredVersion: string,
  foundVersion: string,
): string {
  return `OneOf input types are only supported in \`graphql@${requiredVersion}\` and later but Grats found \`graphql@${foundVersion}\`. Please upgrade your version of graphql-js in order to use this feature.`;
}

export function oneOfNotOnUnion(): string {
  return "Expected the type of a @gqlInput with @oneOf to be attached to a TypeScript union.";
}

export function oneOfFieldNotTypeLiteralWithOneProperty(): string {
  return "Expected each member of a @oneOf @gqlInput to be a TypeScript object literal with exactly one property.";
}

export function oneOfPropertyMissingTypeAnnotation(): string {
  return "Expected each property of a @oneOf @gqlInput to have a type annotation.";
}

export function contextTagOnNonDeclaration(): string {
  return `Invalid \`@${CONTEXT_TAG}\` tag annotation. Expected the \`@${CONTEXT_TAG}\` tag to be attached to a type, interface or class declaration.`;
}

export function duplicateContextTag(): string {
  return `Unexpected duplicate \`@${CONTEXT_TAG}\` tag. Only one type in a project may be annotated with the \`@${CONTEXT_TAG}\`.`;
}

export function userDefinedInfoTag(): string {
  return `Unexpected user-defined \`@${INFO_TAG}\` tag. Use the type \`GqlInfo\` exported from \`grats\`: \`import type { GqlInfo } from "grats";\`.`;
}

export function invalidResolverParamType(): string {
  return "Unexpected GraphQL type used as resolver parameter. Resolver input arguments must be specified as a single `args` object literal: `args: {argName: ArgType}`.";
}

export function exportedArrowFunctionNotConst(): string {
  return `Expected \`@${FIELD_TAG}\` arrow function to be declared as \`const\`.`;
}

export function exportedFieldVariableMultipleDeclarations(n: number): string {
  return `Expected only one declaration when defining a \`@${FIELD_TAG}\`, found ${n}.`;
}

export function fieldVariableNotTopLevelExported(): string {
  return `Expected \`@${FIELD_TAG}\` to be an exported top-level declaration. Grats needs to import resolver functions into its generated schema module, so the resolver function must be exported from the module.`;
}

export function fieldVariableIsNotArrowFunction(): string {
  return `Expected \`@${FIELD_TAG}\` on variable declaration to be attached to an arrow function.`;
}

export function positionalResolverArgDoesNotHaveName(): string {
  return "Expected resolver argument to have a name. Grats needs to be able to see the name of the argument in order to derive a GraphQL argument name.";
}

export function positionalArgAndArgsObject(): string {
  return "Unexpected arguments object in resolver that is also using positional GraphQL arguments. Grats expects that either all GraphQL arguments will be defined in a single object, or that all GraphQL arguments will be defined using positional arguments. The two strategies may not be combined.";
}

export function contextOrInfoUsedInGraphQLPosition(kind: "CONTEXT" | "INFO") {
  const tag = kind === "CONTEXT" ? CONTEXT_TAG : INFO_TAG;
  return `Cannot use \`${tag}\` as a type in GraphQL type position.`;
}

export function typeWithNoFields(kind: string, typeName: string) {
  return `${kind} \`${typeName}\` must define one or more fields.\n\nDefine a field by adding \`/** @${FIELD_TAG} */\` above a field, property, attribute or method of this type, or above a function that has \`${typeName}\` as its first argument.`;
}

export function noTypesDefined() {
  return `Grats could not find any GraphQL types defined in this project.\n\nDeclare a type by adding a \`/** @${TYPE_TAG} */\` docblock above a class, interface, or type alias declaration.\nGrats looks for docblock tags in any TypeScript file included in your TypeScript project.`;
}

export function tsConfigNotFound(cwd: string) {
  return `Grats: Could not find \`tsconfig.json\` searching in ${cwd}.\n\nSee https://www.typescriptlang.org/download/ for instructors on how to add TypeScript to your project. Then run \`npx tsc --init\` to create a \`tsconfig.json\` file.`;
}

export function cyclicDerivedContext() {
  return `Cyclic dependency detected in derived context. This derived context value depends upon itself.`;
}

export function invalidDerivedContextArgType() {
  return "Invalid type for derived context function argument. Derived context functions may only accept other `@gqlContext` types as arguments.";
}

export function missingReturnTypeForDerivedResolver() {
  return 'Expected derived resolver to have an explicit return type. This is needed to allow Grats to "see" which type to treat as a derived context type.';
}

export function derivedResolverInvalidReturnType() {
  return "Expected derived resolver function's return type to be a type reference. Grats uses this type reference to determine which type to treat as a derived context type.";
}

export function directiveTagOnWrongNode() {
  return `\`@${DIRECTIVE_TAG}\` can only be used on function declarations.`;
}

export function directiveTagCommentNotText() {
  return "Expected Grats JSDoc tag value to be simple text.";
}

export function specifiedByDeprecated() {
  return 'The `@specifiedBy` tag has been deprecated in favor of `@gqlAnnotate`. Use `@gqlAnnotate specifiedBy(url: "http://example.com")` instead.';
}

export function directiveTagNoComment() {
  return "Expected `@gqlDirective` tag to specify at least one location.";
}

export function directiveFunctionNotNamed() {
  return "Expected `@gqlDirective` function to be named.";
}

export function directiveArgumentNotObject() {
  return "Expected first argument of a `@gqlDirective` function to be typed using an inline object literal.";
}

export function scalarNotExported(): string {
  return "Expected custom scalar to be an exported type. Grats needs to import this type to build types for the coercion functions.";
}
