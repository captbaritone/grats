//! Port of graphql-js `language/printer.ts`.
//!
//! PORT: graphql-js prints by visiting the AST with a reducer per node kind,
//! where each reducer receives its children already printed. Here each kind
//! has a function which prints its children directly. Only the type system
//! subset of the AST is ported (see `ast.rs`).

use super::ast::*;
use super::block_string::print_block_string;
use super::print_string::print_string;

/// Converts an AST into a string, using one set of reasonable
/// formatting rules.
pub fn print(ast: &DocumentNode) -> String {
    print_document(ast)
}

fn print_name(node: &NameNode) -> String {
    node.value.clone()
}

// Document

fn print_document(node: &DocumentNode) -> String {
    join(node.definitions.iter().map(print_definition), "\n\n")
}

/// PORT: graphql-js's `print` accepts any node. Grats prints definitions on
/// their own to leave some of a document's out.
pub fn print_definition(node: &DefinitionNode) -> String {
    match node {
        DefinitionNode::SchemaDefinition(node) => print_schema_definition(node),
        DefinitionNode::ScalarTypeDefinition(node) => print_scalar_type_definition(node),
        DefinitionNode::ObjectTypeDefinition(node) => print_object_type_definition(node),
        DefinitionNode::InterfaceTypeDefinition(node) => print_interface_type_definition(node),
        DefinitionNode::UnionTypeDefinition(node) => print_union_type_definition(node),
        DefinitionNode::EnumTypeDefinition(node) => print_enum_type_definition(node),
        DefinitionNode::InputObjectTypeDefinition(node) => print_input_object_type_definition(node),
        DefinitionNode::DirectiveDefinition(node) => print_directive_definition(node),
        DefinitionNode::SchemaExtension(node) => print_schema_extension(node),
        DefinitionNode::ScalarTypeExtension(node) => print_scalar_type_extension(node),
        DefinitionNode::ObjectTypeExtension(node) => print_object_type_extension(node),
        DefinitionNode::InterfaceTypeExtension(node) => print_interface_type_extension(node),
        DefinitionNode::UnionTypeExtension(node) => print_union_type_extension(node),
        DefinitionNode::EnumTypeExtension(node) => print_enum_type_extension(node),
        DefinitionNode::InputObjectTypeExtension(node) => print_input_object_type_extension(node),
    }
}

fn print_argument(node: &ConstArgumentNode) -> String {
    print_name(&node.name) + ": " + &print_value(&node.value)
}

// Value

/// PORT: graphql-js's `print` accepts any node. Values are printed on their own
/// in error messages.
pub fn print_value(node: &ConstValueNode) -> String {
    match node {
        ConstValueNode::IntValue(node) => node.value.clone(),
        ConstValueNode::FloatValue(node) => node.value.clone(),
        ConstValueNode::StringValue(node) => print_string_value(node),
        ConstValueNode::BooleanValue(node) => {
            if node.value {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        ConstValueNode::NullValue(_) => "null".to_string(),
        ConstValueNode::EnumValue(node) => node.value.clone(),
        ConstValueNode::ListValue(node) => {
            "[".to_string() + &join(node.values.iter().map(print_value), ", ") + "]"
        }
        ConstValueNode::ObjectValue(node) => {
            "{".to_string() + &join(node.fields.iter().map(print_object_field), ", ") + "}"
        }
    }
}

fn print_string_value(node: &StringValueNode) -> String {
    if node.block {
        print_block_string(&node.value)
    } else {
        print_string(&node.value)
    }
}

fn print_object_field(node: &ConstObjectFieldNode) -> String {
    print_name(&node.name) + ": " + &print_value(&node.value)
}

// Directive

/// PORT: graphql-js's `print` accepts any node. Directives are printed on
/// their own by the parser's tests.
pub fn print_directive(node: &ConstDirectiveNode) -> String {
    "@".to_string()
        + &print_name(&node.name)
        + &wrap(
            "(",
            &join(node.arguments.iter().flatten().map(print_argument), ", "),
            ")",
        )
}

// Type

/// PORT: graphql-js's `print` accepts any node. Types are printed on their own
/// by `ProvidedRequiredArgumentsOnDirectivesRule`.
pub fn print_type(node: &TypeNode) -> String {
    match node {
        TypeNode::NamedType(node) => print_named_type(node),
        TypeNode::ListType(node) => print_list_type(node),
        TypeNode::NonNullType(node) => print_non_null_type(node),
    }
}

fn print_named_type(node: &NamedTypeNode) -> String {
    print_name(&node.name)
}

fn print_list_type(node: &ListTypeNode) -> String {
    "[".to_string() + &print_type(&node.r#type) + "]"
}

fn print_non_null_type(node: &NonNullTypeNode) -> String {
    let r#type = match &*node.r#type {
        NullableTypeNode::NamedType(node) => print_named_type(node),
        NullableTypeNode::ListType(node) => print_list_type(node),
    };
    r#type + "!"
}

// Type System Definitions

fn print_schema_definition(node: &SchemaDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "schema".to_string(),
                print_directives(&node.directives),
                block(
                    node.operation_types
                        .iter()
                        .map(print_operation_type_definition),
                ),
            ],
            " ",
        )
}

fn print_operation_type_definition(node: &OperationTypeDefinitionNode) -> String {
    node.operation.as_str().to_string() + ": " + &print_named_type(&node.r#type)
}

fn print_scalar_type_definition(node: &ScalarTypeDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "scalar".to_string(),
                print_name(&node.name),
                print_directives(&node.directives),
            ],
            " ",
        )
}

fn print_object_type_definition(node: &ObjectTypeDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "type".to_string(),
                print_name(&node.name),
                wrap("implements ", &print_interfaces(&node.interfaces), ""),
                print_directives(&node.directives),
                block(node.fields.iter().flatten().map(print_field_definition)),
            ],
            " ",
        )
}

fn print_field_definition(node: &FieldDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &print_name(&node.name)
        + &print_arguments_definition(&node.arguments)
        + ": "
        + &print_type(&node.r#type)
        + &wrap(" ", &print_directives(&node.directives), "")
}

fn print_input_value_definition(node: &InputValueDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                print_name(&node.name) + ": " + &print_type(&node.r#type),
                wrap(
                    "= ",
                    &node
                        .default_value
                        .as_ref()
                        .map(print_value)
                        .unwrap_or_default(),
                    "",
                ),
                print_directives(&node.directives),
            ],
            " ",
        )
}

fn print_interface_type_definition(node: &InterfaceTypeDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "interface".to_string(),
                print_name(&node.name),
                wrap("implements ", &print_interfaces(&node.interfaces), ""),
                print_directives(&node.directives),
                block(node.fields.iter().flatten().map(print_field_definition)),
            ],
            " ",
        )
}

fn print_union_type_definition(node: &UnionTypeDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "union".to_string(),
                print_name(&node.name),
                print_directives(&node.directives),
                wrap("= ", &print_union_types(&node.types), ""),
            ],
            " ",
        )
}

fn print_enum_type_definition(node: &EnumTypeDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "enum".to_string(),
                print_name(&node.name),
                print_directives(&node.directives),
                block(
                    node.values
                        .iter()
                        .flatten()
                        .map(print_enum_value_definition),
                ),
            ],
            " ",
        )
}

fn print_enum_value_definition(node: &EnumValueDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [print_name(&node.name), print_directives(&node.directives)],
            " ",
        )
}

fn print_input_object_type_definition(node: &InputObjectTypeDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + &join(
            [
                "input".to_string(),
                print_name(&node.name),
                print_directives(&node.directives),
                block(
                    node.fields
                        .iter()
                        .flatten()
                        .map(print_input_value_definition),
                ),
            ],
            " ",
        )
}

fn print_directive_definition(node: &DirectiveDefinitionNode) -> String {
    wrap("", &print_description(&node.description), "\n")
        + "directive @"
        + &print_name(&node.name)
        + &print_arguments_definition(&node.arguments)
        + if node.repeatable { " repeatable" } else { "" }
        + " on "
        + &join(node.locations.iter().map(print_name), " | ")
}

fn print_schema_extension(node: &SchemaExtensionNode) -> String {
    join(
        [
            "extend schema".to_string(),
            print_directives(&node.directives),
            block(
                node.operation_types
                    .iter()
                    .flatten()
                    .map(print_operation_type_definition),
            ),
        ],
        " ",
    )
}

fn print_scalar_type_extension(node: &ScalarTypeExtensionNode) -> String {
    join(
        [
            "extend scalar".to_string(),
            print_name(&node.name),
            print_directives(&node.directives),
        ],
        " ",
    )
}

fn print_object_type_extension(node: &ObjectTypeExtensionNode) -> String {
    join(
        [
            "extend type".to_string(),
            print_name(&node.name),
            wrap("implements ", &print_interfaces(&node.interfaces), ""),
            print_directives(&node.directives),
            block(node.fields.iter().flatten().map(print_field_definition)),
        ],
        " ",
    )
}

fn print_interface_type_extension(node: &InterfaceTypeExtensionNode) -> String {
    join(
        [
            "extend interface".to_string(),
            print_name(&node.name),
            wrap("implements ", &print_interfaces(&node.interfaces), ""),
            print_directives(&node.directives),
            block(node.fields.iter().flatten().map(print_field_definition)),
        ],
        " ",
    )
}

fn print_union_type_extension(node: &UnionTypeExtensionNode) -> String {
    join(
        [
            "extend union".to_string(),
            print_name(&node.name),
            print_directives(&node.directives),
            wrap("= ", &print_union_types(&node.types), ""),
        ],
        " ",
    )
}

fn print_enum_type_extension(node: &EnumTypeExtensionNode) -> String {
    join(
        [
            "extend enum".to_string(),
            print_name(&node.name),
            print_directives(&node.directives),
            block(
                node.values
                    .iter()
                    .flatten()
                    .map(print_enum_value_definition),
            ),
        ],
        " ",
    )
}

fn print_input_object_type_extension(node: &InputObjectTypeExtensionNode) -> String {
    join(
        [
            "extend input".to_string(),
            print_name(&node.name),
            print_directives(&node.directives),
            block(
                node.fields
                    .iter()
                    .flatten()
                    .map(print_input_value_definition),
            ),
        ],
        " ",
    )
}

// PORT: The following print fields which several reducers share. In graphql-js
// each reducer inlines them.

fn print_description(description: &Option<StringValueNode>) -> String {
    description
        .as_ref()
        .map(print_string_value)
        .unwrap_or_default()
}

// `join(directives, ' ')`
fn print_directives(directives: &Option<Vec<ConstDirectiveNode>>) -> String {
    join(directives.iter().flatten().map(print_directive), " ")
}

// `join(interfaces, ' & ')`
fn print_interfaces(interfaces: &Option<Vec<NamedTypeNode>>) -> String {
    join(interfaces.iter().flatten().map(print_named_type), " & ")
}

// `join(types, ' | ')`
fn print_union_types(types: &Option<Vec<NamedTypeNode>>) -> String {
    join(types.iter().flatten().map(print_named_type), " | ")
}

// The `FieldDefinition` and `DirectiveDefinition` reducers print their
// arguments one per line if any of them spans multiple lines.
fn print_arguments_definition(arguments: &Option<Vec<InputValueDefinitionNode>>) -> String {
    let args: Vec<String> = arguments
        .iter()
        .flatten()
        .map(print_input_value_definition)
        .collect();
    if has_multiline_items(&args) {
        wrap("(\n", &indent(&join(args, "\n")), "\n)")
    } else {
        wrap("(", &join(args, ", "), ")")
    }
}

/// Given maybeArray, print an empty string if it is null or empty, otherwise
/// print all items together separated by separator if provided
fn join(maybe_array: impl IntoIterator<Item = String>, separator: &str) -> String {
    let mut result = String::new();
    for item in maybe_array {
        if item.is_empty() {
            continue;
        }
        if !result.is_empty() {
            result.push_str(separator);
        }
        result.push_str(&item);
    }
    result
}

/// Given array, print each item on its own line, wrapped in an indented `{ }` block.
fn block(array: impl IntoIterator<Item = String>) -> String {
    wrap("{\n", &indent(&join(array, "\n")), "\n}")
}

/// If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
///
/// PORT: Absent values are passed as empty strings.
fn wrap(start: &str, maybe_string: &str, end: &str) -> String {
    if maybe_string.is_empty() {
        String::new()
    } else {
        start.to_string() + maybe_string + end
    }
}

fn indent(str: &str) -> String {
    wrap("  ", &str.replace('\n', "\n  "), "")
}

fn has_multiline_items(maybe_array: &[String]) -> bool {
    // FIXME: https://github.com/graphql/graphql-js/issues/2203
    maybe_array.iter().any(|str| str.contains('\n'))
}
