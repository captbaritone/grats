use crate::extractor::{
    ALL_GQL_TAGS, CONTEXT_TAG, DIRECTIVE_TAG, ENUM_TAG, FIELD_TAG, IMPLEMENTS_TAG_DEPRECATED,
    INFO_TAG, INPUT_TAG, INTERFACE_TAG, KILLS_PARENT_ON_EXCEPTION_TAG, LIBRARY_IMPORT_NAME,
    SCALAR_TAG, TYPE_TAG, UNION_TAG,
};

pub const ISSUE_URL: &str = "https://github.com/captbaritone/grats/issues";

// TODO: Move these to short URLS that are easier to keep from breaking.
mod doc_urls {
    pub const MERGED_INTERFACES: &str =
        "https://grats.capt.dev/docs/docblock-tags/interfaces/#merged-interfaces";
    pub const PARAMETER_PROPERTIES: &str =
        "https://grats.capt.dev/docs/docblock-tags/fields#class-based-fields";
    pub const COMMENT_SYNTAX: &str = "https://grats.capt.dev/docs/getting-started/comment-syntax";
}

/*
 * Error messages for Grats
 *
 * Ideally each error message conveys all of the following:
 * - What went wrong
 * - What Grats expected with an example
 * - Why Grats expected that
 * - A suggestion for how to fix the error
 * - A link to the Grats documentation
 */

pub fn field_tag_on_wrong_node() -> String {
    format!(
        "`@{FIELD_TAG}` can only be used on method/property declarations, signatures, function or static method declarations."
    )
}

pub fn root_field_tag_on_wrong_node(type_name: &str) -> String {
    format!("`@gql{type_name}Field` can only be used on function or static method declarations.")
}

pub fn kills_parent_on_exception_on_wrong_node() -> String {
    format!(
        "Unexpected `@{KILLS_PARENT_ON_EXCEPTION_TAG}`. `@{KILLS_PARENT_ON_EXCEPTION_TAG}` can only be used in field annotation docblocks. Perhaps you are missing a `@{FIELD_TAG}` tag?"
    )
}

pub fn wrong_casing_for_grats_tag(actual: &str, expected: &str) -> String {
    format!("Incorrect casing for Grats tag `@{actual}`. Use `@{expected}` instead.")
}

// TODO: Add code action
pub fn invalid_grats_tag(actual: &str) -> String {
    let valid_tag_list = ALL_GQL_TAGS.map(|t| format!("`@{t}`")).join(", ");
    format!("`@{actual}` is not a valid Grats tag. Valid tags are: {valid_tag_list}.")
}

pub fn invalid_type_tag_usage() -> String {
    format!(
        "`@{TYPE_TAG}` can only be used on class, interface or type declarations. e.g. `class MyType {{}}`"
    )
}

pub fn invalid_scalar_tag_usage() -> String {
    format!(
        "`@{SCALAR_TAG}` can only be used on type alias declarations. e.g. `type MyScalar = string`"
    )
}

pub fn invalid_interface_tag_usage() -> String {
    format!(
        "`@{INTERFACE_TAG}` can only be used on interface declarations. e.g. `interface MyInterface {{}}`"
    )
}

pub fn invalid_enum_tag_usage() -> String {
    format!(
        "`@{ENUM_TAG}` can only be used on enum declarations or TypeScript unions. e.g. `enum MyEnum {{}}` or `type MyEnum = \"foo\" | \"bar\"`"
    )
}

pub fn invalid_input_tag_usage() -> String {
    format!(
        "`@{INPUT_TAG}` can only be used on type alias, interface declarations or type unions. e.g. `type MyInput = {{ foo: string }}` or `interface MyInput {{ foo: string }}`"
    )
}

pub fn invalid_union_tag_usage() -> String {
    format!(
        "`@{UNION_TAG}` can only be used on type alias declarations. e.g. `type MyUnion = TypeA | TypeB`"
    )
}

pub fn expected_union_type_node() -> String {
    format!(
        "Expected a TypeScript union. `@{UNION_TAG}` can only be used on TypeScript unions or a single type reference. e.g. `type MyUnion = TypeA | TypeB` or `type MyUnion = TypeA`"
    )
}

pub fn expected_union_type_reference() -> String {
    format!(
        "Expected `@{UNION_TAG}` union members to be type references. Grats expects union members to be references to something annotated with `@gqlType`."
    )
}

pub fn invalid_parent_arg_for_function_field() -> String {
    format!(
        "Expected `@{FIELD_TAG}` function to have a first argument representing the type to extend. If you don't need access to the parent object in the function, you can name the variable `_` to indicate that it is unused. e.g. `function myField(_: ParentType) {{}}`"
    )
}

pub fn invalid_return_type_for_function_field() -> String {
    "Expected GraphQL field to have an explicit return type. This is needed to allow Grats to \"see\" the type of the field.".to_string()
}

pub fn function_field_not_top_level() -> String {
    format!(
        "Expected `@{FIELD_TAG}` function to be a top-level declaration. Grats needs to import resolver functions into its generated schema module, so the resolver function must be an exported."
    )
}

pub fn static_method_class_not_top_level() -> String {
    format!(
        "Expected class with a static `@{FIELD_TAG}` method to be a top-level declaration. Grats needs to import resolver methods into its generated schema module, so the resolver's class must be an exported."
    )
}

pub fn static_method_field_class_not_exported() -> String {
    format!(
        "Expected `@{FIELD_TAG}` static method's class to be exported. Grats needs to import resolvers into its generated schema module, so the resolver class must be an exported."
    )
}

const FUNCTION_PARENT_TYPE_CONTEXT: &str = "Grats treats the first argument as the parent object of the field. Therefore Grats needs to see the _type_ of the first argument in order to know to which type/interface this field should be added.";

pub fn function_field_parent_type_missing() -> String {
    format!(
        "Expected first argument of a `@{FIELD_TAG}` function to have an explicit type annotation. {FUNCTION_PARENT_TYPE_CONTEXT}"
    )
}

pub fn function_field_parent_type_not_valid() -> String {
    format!(
        "Expected first argument of a `@{FIELD_TAG}` function to be typed as a type reference. {FUNCTION_PARENT_TYPE_CONTEXT}"
    )
}

pub fn function_field_not_named() -> String {
    format!(
        "Expected `@{FIELD_TAG}` function to be named. Grats uses the name of the function to derive the name of the GraphQL field. Additionally, Grats needs to import resolver functions into its generated schema module, so the resolver function must be a named export."
    )
}

pub fn function_field_not_named_export() -> String {
    format!(
        "Expected a `@{FIELD_TAG}` function to be a named export. Grats needs to import resolver functions into its generated schema module, so the resolver function must be a named export."
    )
}

pub fn input_type_not_literal() -> String {
    format!(
        "`@{INPUT_TAG}` can only be used on type literals. e.g. `type MyInput = {{ foo: string }}`"
    )
}

pub fn input_type_field_not_property() -> String {
    format!(
        "`@{INPUT_TAG}` types only support property signature members. e.g. `type MyInput = {{ foo: string }}`"
    )
}

pub fn input_interface_field_not_property() -> String {
    format!(
        "`@{INPUT_TAG}` interfaces only support property signature members. e.g. `interface MyInput {{ foo: string }}`"
    )
}

pub fn input_field_untyped() -> String {
    "Input field must have an explicit type annotation. Grats uses the type annotation to determine the type of the field, so it must be explicit in order for Grats to \"see\" the type.".to_string()
}

pub fn type_tag_on_unnamed_class() -> String {
    format!(
        "Unexpected `@{TYPE_TAG}` annotation on unnamed class declaration. Grats uses the name of the class to derive the name of the GraphQL type. Consider naming the class."
    )
}

pub fn type_tag_on_alias_of_non_object_or_unknown() -> String {
    format!(
        "Expected `@{TYPE_TAG}` type to be an object type literal (`{{ }}`) or `unknown`. For example: `type Foo = {{ bar: string }}` or `type Query = unknown`."
    )
}

// TODO: Add code action
pub fn type_name_not_declaration() -> String {
    "Expected `__typename` to be a property declaration. For example: `__typename: \"MyType\"`."
        .to_string()
}

const TYPENAME_CONTEXT: &str = "This is needed to ensure Grats can determine the type of this object during GraphQL execution.";

fn type_name_property_example(expected_name: &str) -> String {
    format!(
        "For example: `__typename = \"{expected_name}\" as const` or `__typename: \"{expected_name}\";`."
    )
}

pub fn type_name_missing_initializer() -> String {
    format!(
        "Expected `__typename` property to have an initializer or a string literal type.  {TYPENAME_CONTEXT}"
    )
}

pub fn type_name_initialize_not_string(expected_name: &str) -> String {
    format!(
        "Expected `__typename` property initializer to be a string literal. {} {TYPENAME_CONTEXT}",
        type_name_property_example(expected_name)
    )
}

pub fn type_name_initialize_not_expression(expected_name: &str) -> String {
    format!(
        "Expected `__typename` property initializer to be an expression with a const assertion. {} {TYPENAME_CONTEXT}",
        type_name_property_example(expected_name)
    )
}

pub fn type_name_type_not_reference_node(expected_name: &str) -> String {
    format!(
        "Expected `__typename` property must be correctly defined. {} {TYPENAME_CONTEXT}",
        type_name_property_example(expected_name)
    )
}

pub fn type_name_type_name_not_identifier(expected_name: &str) -> String {
    format!(
        "Expected `__typename` property name must be correctly specified. {} {TYPENAME_CONTEXT}",
        type_name_property_example(expected_name)
    )
}

pub fn type_name_type_name_not_const(expected_name: &str) -> String {
    format!(
        "Expected `__typename` property type name to be \"const\". {} {TYPENAME_CONTEXT}",
        type_name_property_example(expected_name)
    )
}

pub fn type_name_initializer_wrong(expected: &str, actual: &str) -> String {
    format!(
        "Expected `__typename` property initializer to be `\"{expected}\"`, found `\"{actual}\"`. {TYPENAME_CONTEXT}"
    )
}

pub fn type_name_missing_type_annotation(expected: &str) -> String {
    format!(
        "Expected `__typename` property signature to specify the typename as a string literal string type. For example `__typename: \"{expected}\";`. {TYPENAME_CONTEXT}"
    )
}

pub fn type_name_type_not_string_literal(expected: &str) -> String {
    format!(
        "Expected `__typename` property signature to specify the typename as a string literal string type. For example `__typename: \"{expected}\";`. {TYPENAME_CONTEXT}"
    )
}

pub fn type_name_does_not_match_expected(expected: &str) -> String {
    format!("Expected `__typename` property to be `\"{expected}\"`. {TYPENAME_CONTEXT}")
}

pub fn resolver_param_is_missing_type() -> String {
    "Missing type annotation for resolver argument. Expected all resolver arguments to have an explicit type annotation. Grats needs to be able to see the type of the arguments to generate an executable GraphQL schema.".to_string()
}

pub fn multiple_resolver_type_literals() -> String {
    "Unexpected multiple resolver parameters typed with an object literal. Grats assumes a resolver parameter typed with object literals describes the GraphQL arguments. Therefore only one such parameter is permitted.".to_string()
}

pub fn arg_is_not_property() -> String {
    "Expected GraphQL field argument type to be a property signature. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.".to_string()
}

pub fn arg_name_not_literal() -> String {
    "Expected GraphQL field argument names to be a literal. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.".to_string()
}

pub fn arg_not_typed() -> String {
    "Expected GraphQL field argument to have an explicit type annotation. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.".to_string()
}

pub fn enum_tag_on_invalid_node() -> String {
    format!(
        "Expected `@{ENUM_TAG}` to be a union type, a string literal in the edge case of a single value enum, or a const array/object type query (e.g. `(typeof VALUES)[number]` or `(typeof OBJ)[keyof typeof OBJ]`). For example: `type MyEnum = \"foo\" | \"bar\"` or `type MyEnum = \"foo\"`."
    )
}

pub fn enum_variant_not_string_literal() -> String {
    format!(
        "Expected `@{ENUM_TAG}` enum members to be string literal types. For example: `'foo'`. Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema."
    )
}

pub fn enum_variant_missing_initializer() -> String {
    format!(
        "Expected `@{ENUM_TAG}` enum members to have string literal initializers. For example: `FOO = 'foo'`. In GraphQL enum values are strings, and Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema."
    )
}

pub fn enum_const_must_precede_type_alias() -> String {
    format!(
        "When deriving a `@{ENUM_TAG}` from a const value using `typeof`, the const declaration must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema. For example:\n\nconst VALUES = [\"FOO\", \"BAR\"] as const;\n\n/** @{ENUM_TAG} */\ntype MyEnum = (typeof VALUES)[number];"
    )
}

pub fn enum_const_missing_as_const() -> String {
    format!(
        "Expected the const declaration preceding this `@{ENUM_TAG}` to use `as const`. Grats needs the literal types to determine the enum values. For example: `const VALUES = [\"FOO\", \"BAR\"] as const;`"
    )
}

pub fn enum_const_invalid_expression() -> String {
    format!(
        "Expected the const declaration preceding this `@{ENUM_TAG}` to be an array literal or object literal with `as const`. For example: `const VALUES = [\"FOO\", \"BAR\"] as const;` or `const OBJ = {{ Foo: \"FOO\" }} as const;`"
    )
}

pub fn enum_const_name_mismatch(expected: &str, found: &str) -> String {
    format!(
        "Expected the `const` declaration immediately before this `@{ENUM_TAG}` to be named `{expected}` (to match `typeof {expected}`), but found `{found}`. The `const` referenced in the type must be the immediately preceding statement. Grats requires this co-location to ensure it's clear which declarations contribute to the GraphQL schema."
    )
}

pub fn gql_entity_missing_name() -> String {
    "Expected GraphQL entity to have a name. Grats uses the name of the entity to derive the name of the GraphQL construct.".to_string()
}

pub fn method_missing_type() -> String {
    "Expected GraphQL field methods to have an explicitly defined return type. Grats needs to be able to see the type of the field to generate its type in the GraphQL schema.".to_string()
}

pub fn wrapper_missing_type_arg(wrapper_type_name: &str) -> String {
    format!(
        "Expected `{wrapper_type_name}` type to have exactly one type argument. Grats needs to be able to see the inner type in order to generate a GraphQL schema."
    )
}

pub fn invalid_wrapper_on_input_type(wrapper_name: &str) -> String {
    format!(
        "Invalid input type. `{wrapper_name}` is not a valid type when used as a GraphQL input value."
    )
}

pub fn cannot_resolve_symbol_for_description() -> String {
    "Expected TypeScript to be able to resolve this GraphQL entity to a symbol. Is it possible that this type is not defined in this file? Grats needs to follow type references to their declaration in order to determine which GraphQL name is being referenced.".to_string()
}

pub fn property_field_missing_type() -> String {
    "Expected GraphQL field to have an explicitly defined type annotation. Grats needs to be able to see the type of the field to generate a field's type in the GraphQL schema.".to_string()
}

pub fn expected_one_non_nullish_type() -> String {
    format!(
        "Expected exactly one non-nullish type. GraphQL does not support fields returning an arbitrary union of types. Consider defining an explicit `@{UNION_TAG}` union type and returning that."
    )
}

// TODO: Add code action
pub fn ambiguous_number_type() -> String {
    format!(
        "Unexpected number type. GraphQL supports both Int and Float, making `number` ambiguous. Instead, import the `Int` or `Float` type from `{LIBRARY_IMPORT_NAME}` and use that. e.g. `import type {{ Int, Float }} from \"{LIBRARY_IMPORT_NAME}\";`."
    )
}

pub fn ambiguous_number_literal_type() -> String {
    format!(
        "Unexpected numeric literal type. GraphQL supports both Int and Float. To ensure Grats infers the correct type, use the `Int` or `Float` type from `{LIBRARY_IMPORT_NAME}` instead. e.g. `import type {{ Int, Float }} from \"{LIBRARY_IMPORT_NAME}\";`."
    )
}

pub fn literal_type_in_input_position() -> String {
    "Literal types like `true`, `\"hello\"`, or `42` cannot be used in GraphQL input positions (e.g., field arguments). GraphQL has no way to enforce that only this specific value is passed. Use the broader type (`Boolean`, `String`, `Int`, etc.) instead.".to_string()
}

pub fn default_value_is_not_literal() -> String {
    "Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `\"foo\"`.".to_string()
}

pub fn default_arg_element_is_not_assignment() -> String {
    "Expected property to be a default assignment. For example: `{ first = 10}`. Grats needs to extract a literal GraphQL value here, and that requires Grats being able to see the literal value in the source code.".to_string()
}

pub fn default_arg_property_missing_name() -> String {
    "Expected object literal property to have a name. Grats needs to extract a literal value here, and that requires Grats being able to see the literal value and its field name in the source code.".to_string()
}

pub fn default_arg_property_missing_initializer() -> String {
    "Expected object literal property to have an initializer. For example: `{ offset = 10}`. Grats needs to extract a literal GraphQL value here, and that requires Grats being able to see the literal value in the source code.".to_string()
}

pub fn unsupported_type_literal() -> String {
    "Unexpected type literal. Grats expects types in GraphQL positions to be scalar types, or reference a named GraphQL type directly. You may want to define a named GraphQL type elsewhere and reference it here.".to_string()
}

pub fn unknown_graphql_type() -> String {
    "Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.".to_string()
}

pub fn plural_type_missing_parameter() -> String {
    "Expected wrapper type reference to have type arguments. Grats needs to be able to see the return type in order to generate a GraphQL schema.".to_string()
}

pub fn expected_name_identifier() -> String {
    "Expected a name identifier. Grats expected to find a name here which it could use to derive the GraphQL name.".to_string()
}

// TODO: Add code action
pub fn kills_parent_on_exception_with_wrong_config() -> String {
    format!(
        "Unexpected `@{KILLS_PARENT_ON_EXCEPTION_TAG}` tag. `@{KILLS_PARENT_ON_EXCEPTION_TAG}` is only supported when the Grats config option `nullableByDefault` is enabled in your `tsconfig.json`."
    )
}

// TODO: Add code action
pub fn kills_parent_on_exception_on_nullable() -> String {
    format!(
        "Unexpected `@{KILLS_PARENT_ON_EXCEPTION_TAG}` tag on field typed as nullable. `@{KILLS_PARENT_ON_EXCEPTION_TAG}` will force a field to appear as non-nullable in the schema, so its implementation must also be non-nullable. ."
    )
}

// TODO: Add code action
pub fn non_null_type_cannot_be_optional() -> String {
    "Unexpected optional argument that does not also accept `null`. Optional arguments in GraphQL may get passed an explicit `null` value by the GraphQL executor. This means optional arguments must be typed to also accept `null`. Consider adding `| null` to the end of the argument type.".to_string()
}

pub fn merged_interfaces() -> String {
    format!(
        "Unexpected merged interface. If an interface is declared multiple times in a scope, TypeScript merges them. To avoid ambiguity Grats does not support using merged interfaces as GraphQL definitions. Consider using a unique name for your TypeScript interface and renaming it.\n\n Learn more: {}",
        doc_urls::MERGED_INTERFACES
    )
}

pub fn implements_tag_deprecated() -> String {
    format!(
        "`@{IMPLEMENTS_TAG_DEPRECATED}` has been deprecated. Instead use `class MyType implements MyInterface`."
    )
}

// TODO: Add code action
pub fn implements_tag_on_interface() -> String {
    format!(
        "`@{IMPLEMENTS_TAG_DEPRECATED}` has been deprecated. Instead use `interface MyType extends MyInterface`."
    )
}

pub fn implements_tag_on_type_alias() -> String {
    format!(
        "`@{IMPLEMENTS_TAG_DEPRECATED}` has been deprecated. Types which implement GraphQL interfaces should be defined using TypeScript class or interface declarations."
    )
}

// TODO: Add code action
pub fn duplicate_tag(tag_name: &str) -> String {
    format!(
        "Unexpected duplicate `@{tag_name}` tag. Grats does not accept multiple instances of the same tag."
    )
}

pub fn duplicate_interface_tag() -> String {
    format!(
        "Unexpected duplicate `@{IMPLEMENTS_TAG_DEPRECATED}` tag. To declare that a type or interface implements multiple interfaces list them as comma separated values: `@{IMPLEMENTS_TAG_DEPRECATED} interfaceA, interfaceB`."
    )
}

// TODO: Add code action
pub fn parameter_without_modifiers() -> String {
    format!(
        "Expected `@{FIELD_TAG}` constructor parameter to be a parameter property. This requires a modifier such as `public` or `readonly` before the parameter name.\n\nLearn more: {}",
        doc_urls::PARAMETER_PROPERTIES
    )
}

pub fn parameter_property_not_public() -> String {
    format!(
        "Expected `@{FIELD_TAG}` parameter property to be public. Valid modifiers for `@{FIELD_TAG}` parameter properties are  `public` and `readonly`.\n\nLearn more: {}",
        doc_urls::PARAMETER_PROPERTIES
    )
}

pub fn parameter_property_missing_type() -> String {
    format!(
        "Expected `@{FIELD_TAG}` parameter property to have an explicit type annotation. Grats needs to be able to see the type of the parameter property to generate a GraphQL schema."
    )
}

pub fn invalid_type_passed_to_field_function() -> String {
    format!(
        "Unexpected type passed to `@{FIELD_TAG}` function. `@{FIELD_TAG}` functions can only be used to extend `@{TYPE_TAG}` and `@{INTERFACE_TAG}` types."
    )
}

pub fn unresolved_type_reference() -> String {
    "Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?".to_string()
}

pub fn expected_type_annotation_on_context() -> String {
    "Expected context parameter to have an explicit type annotation. Grats validates that your context parameter is type-safe by checking that all context values reference the same type declaration.".to_string()
}

pub fn expected_type_annotation_of_reference_on_context() -> String {
    "Expected context parameter's type to be a type reference. Grats validates that your context parameter is type-safe by checking that all context values reference the same type declaration.".to_string()
}

pub fn expected_type_annotation_on_context_to_be_resolvable() -> String {
    // TODO: Provide guidance?
    // TODO: I don't think we have a test case that triggers this error.
    "Unable to resolve context parameter type. Grats validates that your context parameter is type-safe by checking that all context values reference the same type declaration.".to_string()
}

pub fn expected_type_annotation_on_context_to_have_declaration() -> String {
    "Unable to locate the declaration of the context parameter's type. Grats validates that your context parameter is type-safe by checking all context values reference the same type declaration. Did you forget to import or define this type?".to_string()
}

pub fn unexpected_param_spread_for_resolver_param() -> String {
    "Unexpected spread argument in resolver. Grats expects all resolver arguments to be a single, explicitly-typed argument.".to_string()
}

pub fn resolver_param_is_unknown() -> String {
    // TODO: Give guidance that this is a change?
    "Unexpected `unknown` type for resolver argument. If a resolver argument is not needed by the resolver, it may be omitted.".to_string()
}

pub fn resolver_param_is_never() -> String {
    // TODO: Give guidance that this is a change?
    "Unexpected `never` type for resolver argument. If a resolver argument is not needed by the resolver, it may be omitted.".to_string()
}

pub fn unexpected_resolver_param_type() -> String {
    "Unexpected type for resolver argument. Resolver arguments must be typed with either an object literal (`{}`) or a reference to a named type.".to_string()
}

pub fn multiple_context_types() -> String {
    "Context argument's type does not match. Grats expects all resolvers that read the context argument to use the same type for that argument. Did you use the incorrect type in one of your resolvers?".to_string()
}

pub fn graphql_name_has_leading_newlines(name: &str, tag_name: &str) -> String {
    format!("Expected the GraphQL name `{name}` to be on the same line as it's `@{tag_name}` tag.")
}

pub fn graphql_tag_name_has_whitespace(tag_name: &str) -> String {
    format!(
        "Expected text following a `@{tag_name}` tag to be a GraphQL name. If you intended this text to be a description, place it at the top of the docblock before any `@tags`."
    )
}

pub fn subscription_field_not_async_iterable() -> String {
    "Expected fields on `Subscription` to return an `AsyncIterable`. Fields on `Subscription` model a subscription, which is a stream of events. Grats expects fields on `Subscription` to return an `AsyncIterable` which can be used to model this stream.".to_string()
}

pub fn operation_type_not_unknown() -> String {
    "Operation types `Query`, `Mutation`, and `Subscription` must be defined as type aliases of `unknown`. E.g. `type Query = unknown`. This is because GraphQL servers do not have an agreed upon way to produce root values, and Grats errs on the side of safety. If you are trying to implement dependency injection, consider using the `context` argument passed to each resolver instead. If you have a strong use case for a concrete root value, please file an issue.".to_string()
}

pub fn expected_nullable_argument_to_be_optional() -> String {
    "Expected nullable argument to _also_ be optional (`?`). graphql-js may omit properties on the argument object where an undefined GraphQL variable is passed, or if the argument is omitted in the operation text. To ensure your resolver is capable of handling this scenario, add a `?` to the end of the argument name to make it optional. e.g. `{greeting?: string | null}`".to_string()
}

pub fn gql_tag_in_line_comment() -> String {
    format!(
        "Unexpected Grats tag in line (`//`) comment. Grats looks for tags in JSDoc-style block comments. e.g. `/** @gqlType */`. For more information see: {}",
        doc_urls::COMMENT_SYNTAX
    )
}

pub fn gql_tag_in_non_jsdoc_block_comment() -> String {
    format!(
        "Unexpected Grats tag in non-JSDoc-style block comment. Grats only looks for tags in JSDoc-style block comments which start with `/**`. For more information see: {}",
        doc_urls::COMMENT_SYNTAX
    )
}

pub fn gql_tag_in_detached_jsdoc_block_comment() -> String {
    format!(
        "Unexpected Grats tag in detached docblock. Grats was unable to determine which TypeScript declaration this docblock is associated with. Moving the docblock to a position that is unambiguously \"above\" the relevant declaration may help. For more information see: {}",
        doc_urls::COMMENT_SYNTAX
    )
}

pub fn gql_field_tag_on_input_type() -> String {
    format!(
        "The tag `@{FIELD_TAG}` is not needed on fields of input types. All fields are automatically included as part of the input type. This tag can be safely removed."
    )
}

// TODO: Add code action
pub fn gql_field_parent_missing_tag() -> String {
    format!(
        "Unexpected `@{FIELD_TAG}`. The parent construct must be either a `@{TYPE_TAG}` or `@{INTERFACE_TAG}` tag. Are you missing one of these tags?"
    )
}

pub fn missing_generic_type(template_name: &str, param_name: &str) -> String {
    format!(
        "Missing type argument for generic GraphQL type. Expected `{template_name}` to be passed a GraphQL type argument for type parameter `{param_name}`."
    )
}

pub fn non_graphql_generic_type(template_name: &str, param_name: &str) -> String {
    format!(
        "Expected `{template_name}` to be passed a GraphQL type argument for type parameter `{param_name}`."
    )
}

pub fn conflicting_generic_type_name(derived_name: &str) -> String {
    format!(
        "Conflicting name for generic type. Grats names a generic type by prefixing its name with the names of its type arguments, which names this type `{derived_name}`. However, a different type is also named `{derived_name}`. Rename one of the types involved to avoid the conflict."
    )
}

pub fn infinitely_nested_generic_type() -> String {
    "Infinitely nested generic type. Grats defines a GraphQL type for each combination of type arguments a generic type is used with. Here, each type Grats defines would use the generic type with more deeply nested type arguments, so Grats would need to define infinitely many types.".to_string()
}

pub fn generic_type_used_as_union_member() -> String {
    "Unexpected generic type used as union member. Generic type may not currently be used as members of a union. Grats requires that all union members define a `__typename` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct `__typename` property and thus cannot be used as members of a union.".to_string()
}
pub fn generic_type_implements_interface() -> String {
    format!(
        "Unexpected `implements` on generic `{TYPE_TAG}`. Generic types may not currently declare themselves as implementing interfaces. Grats requires that all types which implement an interface define a `__typename` field typed as a string literal matching the type's name. Since generic types are synthesized into multiple types with different names, Grats cannot ensure they have a correct `__typename` property and thus declare themselves as interface implementors."
    )
}

pub fn concrete_typename_implementing_interface_cannot_be_resolved(
    implementor: &str,
    interface_name: &str,
) -> String {
    format!(
        "Cannot resolve typename. The type `{implementor}` implements `{interface_name}`, so it must either have a `__typename` property or be an exported class."
    )
}

pub fn concrete_typename_in_union_cannot_be_resolved(
    implementor: &str,
    union_name: &str,
) -> String {
    format!(
        "Cannot resolve typename. The type `{implementor}` is a member of `{union_name}`, so it must either have a `__typename` property or be an exported class."
    )
}

// TODO: Add code action
pub fn invalid_field_non_public_access_modifier() -> String {
    format!(
        "Unexpected access modifier on `@{FIELD_TAG}` method. GraphQL fields must be able to be called by the GraphQL executor."
    )
}

pub fn invalid_static_modifier() -> String {
    format!(
        "Unexpected `static` modifier on non-method `@{FIELD_TAG}`. `static` is only valid on method signatures."
    )
}

pub fn static_method_on_non_class() -> String {
    format!(
        "Unexpected `@{FIELD_TAG}` `static` method on non-class declaration. Static method fields may only be declared on exported class declarations."
    )
}

pub fn static_method_class_with_named_export_not_named() -> String {
    format!(
        "Expected `@{FIELD_TAG}` static method's class to be named if exported without the `default` keyword."
    )
}

pub fn one_of_not_supported_graphql(required_version: &str, found_version: &str) -> String {
    format!(
        "OneOf input types are only supported in `graphql@{required_version}` and later but Grats found `graphql@{found_version}`. Please upgrade your version of graphql-js in order to use this feature."
    )
}

pub fn one_of_not_on_union() -> String {
    "Expected the type of a @gqlInput with @oneOf to be attached to a TypeScript union.".to_string()
}

pub fn one_of_field_not_type_literal_with_one_property() -> String {
    "Expected each member of a @oneOf @gqlInput to be a TypeScript object literal with exactly one property.".to_string()
}

pub fn one_of_property_missing_type_annotation() -> String {
    "Expected each property of a @oneOf @gqlInput to have a type annotation.".to_string()
}

pub fn context_tag_on_non_declaration() -> String {
    format!(
        "Invalid `@{CONTEXT_TAG}` tag annotation. Expected the `@{CONTEXT_TAG}` tag to be attached to a type, interface or class declaration."
    )
}

pub fn duplicate_context_tag() -> String {
    format!(
        "Unexpected duplicate `@{CONTEXT_TAG}` tag. Only one type in a project may be annotated with the `@{CONTEXT_TAG}`."
    )
}

pub fn user_defined_info_tag() -> String {
    format!(
        "Unexpected user-defined `@{INFO_TAG}` tag. Use the type `GqlInfo` exported from `grats`: `import type {{ GqlInfo }} from \"grats\";`."
    )
}

pub fn invalid_resolver_param_type() -> String {
    "Unexpected GraphQL type used as resolver parameter. Resolver input arguments must be specified as a single `args` object literal: `args: {argName: ArgType}`.".to_string()
}

pub fn exported_arrow_function_not_const() -> String {
    format!("Expected `@{FIELD_TAG}` arrow function to be declared as `const`.")
}

pub fn exported_field_variable_multiple_declarations(n: usize) -> String {
    format!("Expected only one declaration when defining a `@{FIELD_TAG}`, found {n}.")
}

pub fn field_variable_not_top_level_exported() -> String {
    format!(
        "Expected `@{FIELD_TAG}` to be an exported top-level declaration. Grats needs to import resolver functions into its generated schema module, so the resolver function must be exported from the module."
    )
}

pub fn field_variable_is_not_arrow_function() -> String {
    format!("Expected `@{FIELD_TAG}` on variable declaration to be attached to an arrow function.")
}

pub fn positional_resolver_arg_does_not_have_name() -> String {
    "Expected resolver argument to have a name. Grats needs to be able to see the name of the argument in order to derive a GraphQL argument name.".to_string()
}

pub fn positional_arg_and_args_object() -> String {
    "Unexpected arguments object in resolver that is also using positional GraphQL arguments. Grats expects that either all GraphQL arguments will be defined in a single object, or that all GraphQL arguments will be defined using positional arguments. The two strategies may not be combined.".to_string()
}

/// Whether a type is the context or info type.
pub enum ContextOrInfo {
    Context,
    Info,
}

pub fn context_or_info_used_in_graphql_position(kind: ContextOrInfo) -> String {
    let tag = match kind {
        ContextOrInfo::Context => CONTEXT_TAG,
        ContextOrInfo::Info => INFO_TAG,
    };
    format!("Cannot use `{tag}` as a type in GraphQL type position.")
}

pub fn type_with_no_fields(kind: &str, type_name: &str) -> String {
    format!(
        "{kind} `{type_name}` must define one or more fields.\n\nDefine a field by adding `/** @{FIELD_TAG} */` above a field, property, attribute or method of this type, or above a function that has `{type_name}` as its first argument."
    )
}

pub fn no_types_defined() -> String {
    format!(
        "Grats could not find any GraphQL types defined in this project.\n\nDeclare a type by adding a `/** @{TYPE_TAG} */` docblock above a class, interface, or type alias declaration.\nGrats looks for docblock tags in any TypeScript file included in your TypeScript project."
    )
}

pub fn ts_config_not_found(cwd: &str) -> String {
    format!(
        "Grats: Could not find `tsconfig.json` searching in {cwd}.\n\nSee https://www.typescriptlang.org/download/ for instructors on how to add TypeScript to your project. Then run `npx tsc --init` to create a `tsconfig.json` file."
    )
}

pub fn cyclic_derived_context() -> String {
    "Cyclic dependency detected in derived context. This derived context value depends upon itself."
        .to_string()
}

pub fn invalid_derived_context_arg_type() -> String {
    "Invalid type for derived context function argument. Derived context functions may only accept other `@gqlContext` types as arguments.".to_string()
}

pub fn missing_return_type_for_derived_resolver() -> String {
    "Expected derived resolver's return type to be a named type alias, e.g. `: SomeType`. This is needed to allow Grats to \"see\" which type declaration to treat as the derived context type.".to_string()
}

pub fn derived_resolver_invalid_return_type() -> String {
    "Expected derived resolver function's return type to be a type reference. Grats uses this type reference to determine which type to treat as a derived context type.".to_string()
}

pub fn directive_tag_on_wrong_node() -> String {
    format!("`@{DIRECTIVE_TAG}` can only be used on function declarations.")
}

pub fn directive_tag_comment_not_text() -> String {
    "Expected Grats JSDoc tag value to be simple text.".to_string()
}

pub fn specified_by_deprecated() -> String {
    "The `@specifiedBy` tag has been deprecated in favor of `@gqlAnnotate`. Use `@gqlAnnotate specifiedBy(url: \"http://example.com\")` instead.".to_string()
}

pub fn directive_tag_no_comment() -> String {
    "Expected `@gqlDirective` tag to specify at least one location.".to_string()
}

pub fn directive_function_not_named() -> String {
    "Expected `@gqlDirective` function to be named.".to_string()
}

pub fn directive_argument_not_object() -> String {
    "Expected first argument of a `@gqlDirective` function to be typed using an inline object literal.".to_string()
}

pub fn scalar_not_exported() -> String {
    "Expected custom scalar to be an exported type. Grats needs to import this type to build types for the coercion functions.".to_string()
}

pub fn enum_not_exported() -> String {
    "Expected enum to be exported when `tsClientEnums` is configured. Grats needs to import enum types to build the enums module.".to_string()
}

pub fn type_alias_enum_not_supported_with_emit_enums() -> String {
    "Type alias enums are not supported when `tsClientEnums` is configured. Use `enum` declarations instead. For example: `export enum Status { PENDING = \"pending\" }`.".to_string()
}
