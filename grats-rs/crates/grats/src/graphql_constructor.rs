//! Constructors for GraphQL AST nodes located at TypeScript nodes.

use graphql_js::language::ast::{
    BooleanValueNode, ConstArgumentNode, ConstDirectiveNode, ConstListValueNode,
    ConstObjectFieldNode, ConstObjectValueNode, ConstValueNode, DiagnosticHandleResult,
    DirectiveDefinitionNode, EnumTypeDefinitionNode, EnumValueDefinitionNode, EnumValueNode,
    ExportDefinition, FieldDefinitionNode, FloatValueNode, InputObjectTypeDefinitionNode,
    InputValueDefinitionNode, InputValueDefinitionNodeOrResolverArg, IntValueNode,
    InterfaceTypeDefinitionNode, ListTypeNode, NameNode, NamedTypeNode, NonNullTypeNode,
    NullValueNode, NullableTypeNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode,
    ResolverSignature, ScalarTypeDefinitionNode, StringValueNode, TypeNode,
    UnionTypeDefinitionNode,
};

use crate::utils::diagnostic_error::TsLocatableNode;
use crate::utils::helpers::unique_id;

/* Top Level Types */
pub fn directive_definition(
    node: TsLocatableNode,
    name: NameNode,
    args: Option<Vec<InputValueDefinitionNode>>,
    repeatable: bool,
    locations: Vec<NameNode>,
    description: Option<StringValueNode>,
) -> DirectiveDefinitionNode {
    DirectiveDefinitionNode {
        loc: Some(node.loc()),
        name,
        arguments: optional_list(args),
        repeatable,
        locations,
        description,
    }
}

pub fn union_type_definition(
    node: TsLocatableNode,
    name: NameNode,
    types: Vec<NamedTypeNode>,
    description: Option<StringValueNode>,
    directives: Option<Vec<ConstDirectiveNode>>,
) -> UnionTypeDefinitionNode {
    UnionTypeDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        types: Some(types),
        directives: optional_list(directives),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn object_type_definition(
    node: TsLocatableNode,
    name: NameNode,
    fields: Vec<FieldDefinitionNode>,
    interfaces: Option<Vec<NamedTypeNode>>,
    description: Option<StringValueNode>,
    directives: Option<Vec<ConstDirectiveNode>>,
    has_type_name_field: bool,
    exported: Option<ExportDefinition>,
) -> ObjectTypeDefinitionNode {
    ObjectTypeDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        fields: Some(fields),
        interfaces,
        was_synthesized: false,
        has_type_name_field,
        exported,
        directives: optional_list(directives),
    }
}

pub fn interface_type_definition(
    node: TsLocatableNode,
    name: NameNode,
    fields: Vec<FieldDefinitionNode>,
    interfaces: Option<Vec<NamedTypeNode>>,
    description: Option<StringValueNode>,
    directives: Option<Vec<ConstDirectiveNode>>,
) -> InterfaceTypeDefinitionNode {
    InterfaceTypeDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        fields: Some(fields),
        interfaces,
        directives: optional_list(directives),
    }
}

pub fn enum_type_definition(
    node: TsLocatableNode,
    name: NameNode,
    values: Vec<EnumValueDefinitionNode>,
    description: Option<StringValueNode>,
    directives: Option<Vec<ConstDirectiveNode>>,
    exported: Option<ExportDefinition>,
) -> EnumTypeDefinitionNode {
    EnumTypeDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        values: Some(values),
        directives: optional_list(directives),
        exported,
    }
}

/* Top Level Extensions */

pub fn abstract_field_definition(
    node: TsLocatableNode,
    on_type: NameNode,
    field: FieldDefinitionNode,
    may_be_interface: bool,
) -> ObjectTypeExtensionNode {
    ObjectTypeExtensionNode {
        loc: Some(node.loc()),
        name: on_type,
        interfaces: None,
        directives: None,
        fields: Some(vec![field]),
        may_be_interface,
    }
}

/* Field Definitions */
#[allow(clippy::too_many_arguments)]
pub fn field_definition(
    node: TsLocatableNode,
    name: NameNode,
    r#type: TypeNode,
    args: Option<Vec<InputValueDefinitionNode>>,
    directives: Vec<ConstDirectiveNode>,
    description: Option<StringValueNode>,
    kills_parent_on_exception: Option<NameNode>,
    resolver: ResolverSignature,
) -> FieldDefinitionNode {
    FieldDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        r#type,
        arguments: args,
        directives: (!directives.is_empty()).then_some(directives),
        resolver: Some(resolver),
        kills_parent_on_exception,
    }
}

pub fn const_object_field(
    node: TsLocatableNode,
    name: NameNode,
    value: ConstValueNode,
) -> ConstObjectFieldNode {
    ConstObjectFieldNode {
        loc: Some(node.loc()),
        name,
        value,
    }
}

pub fn input_value_definition(
    node: TsLocatableNode,
    name: NameNode,
    r#type: TypeNode,
    directives: Option<Vec<ConstDirectiveNode>>,
    default_value: Option<ConstValueNode>,
    description: Option<StringValueNode>,
) -> InputValueDefinitionNode {
    InputValueDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        r#type,
        default_value,
        directives: optional_list(directives),
    }
}

pub fn input_value_definition_or_resolver_arg(
    node: TsLocatableNode,
    name: DiagnosticHandleResult<NameNode>,
    r#type: TypeNode,
    directives: Option<Vec<ConstDirectiveNode>>,
    default_value: Option<ConstValueNode>,
    description: Option<StringValueNode>,
) -> InputValueDefinitionNodeOrResolverArg {
    InputValueDefinitionNodeOrResolverArg {
        loc: Some(node.loc()),
        description,
        name,
        r#type,
        default_value,
        directives: optional_list(directives),
    }
}

pub fn enum_value_definition(
    node: TsLocatableNode,
    name: NameNode,
    directives: Option<Vec<ConstDirectiveNode>>,
    description: Option<StringValueNode>,
    ts_name: Option<String>,
) -> EnumValueDefinitionNode {
    EnumValueDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        directives,
        ts_name,
    }
}

pub fn scalar_type_definition(
    node: TsLocatableNode,
    name: NameNode,
    directives: Option<Vec<ConstDirectiveNode>>,
    description: Option<StringValueNode>,
    exported: Option<ExportDefinition>,
) -> ScalarTypeDefinitionNode {
    ScalarTypeDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        directives: optional_list(directives),
        exported,
    }
}

pub fn input_object_type_definition(
    node: TsLocatableNode,
    name: NameNode,
    fields: Option<Vec<InputValueDefinitionNode>>,
    directives: Option<Vec<ConstDirectiveNode>>,
    description: Option<StringValueNode>,
) -> InputObjectTypeDefinitionNode {
    InputObjectTypeDefinitionNode {
        loc: Some(node.loc()),
        description,
        name,
        fields,
        directives: optional_list(directives),
    }
}

/* Primitives */
pub fn name(node: TsLocatableNode, value: &str) -> NameNode {
    NameNode {
        loc: Some(node.loc()),
        value: value.to_string(),
        ts_identifier: unique_id(),
    }
}

pub fn named_type(node: TsLocatableNode, value: &str) -> NamedTypeNode {
    NamedTypeNode {
        loc: Some(node.loc()),
        name: name(node, value),
    }
}

pub fn object(node: TsLocatableNode, fields: Vec<ConstObjectFieldNode>) -> ConstObjectValueNode {
    ConstObjectValueNode {
        loc: Some(node.loc()),
        fields,
    }
}

/* Helpers */
pub fn non_null_type(node: TsLocatableNode, r#type: TypeNode) -> TypeNode {
    let r#type = match r#type {
        TypeNode::NonNullType(_) => return r#type,
        TypeNode::NamedType(t) => NullableTypeNode::NamedType(t),
        TypeNode::ListType(t) => NullableTypeNode::ListType(t),
    };
    TypeNode::NonNullType(NonNullTypeNode {
        loc: Some(node.loc()),
        r#type: Box::new(r#type),
    })
}

pub fn list_type(node: TsLocatableNode, r#type: TypeNode) -> ListTypeNode {
    ListTypeNode {
        loc: Some(node.loc()),
        r#type: Box::new(r#type),
        is_async_iterable: false,
    }
}

pub fn list(node: TsLocatableNode, values: Vec<ConstValueNode>) -> ConstListValueNode {
    ConstListValueNode {
        loc: Some(node.loc()),
        values,
    }
}

/// Only used with nullable types.
pub fn with_location(node: TsLocatableNode, value: NullableTypeNode) -> TypeNode {
    match value {
        NullableTypeNode::NamedType(t) => TypeNode::NamedType(NamedTypeNode {
            loc: Some(node.loc()),
            ..t
        }),
        NullableTypeNode::ListType(t) => TypeNode::ListType(ListTypeNode {
            loc: Some(node.loc()),
            ..t
        }),
    }
}

pub fn const_argument(
    node: TsLocatableNode,
    name: NameNode,
    value: ConstValueNode,
) -> ConstArgumentNode {
    ConstArgumentNode {
        loc: Some(node.loc()),
        name,
        value,
    }
}

pub fn const_directive(
    node: TsLocatableNode,
    name: NameNode,
    args: Option<Vec<ConstArgumentNode>>,
) -> ConstDirectiveNode {
    ConstDirectiveNode {
        loc: Some(node.loc()),
        name,
        arguments: optional_list(args),
    }
}

pub fn string(node: TsLocatableNode, value: &str, block: bool) -> StringValueNode {
    StringValueNode {
        loc: Some(node.loc()),
        value: value.to_string(),
        block,
    }
}

pub fn float(node: TsLocatableNode, value: &str) -> FloatValueNode {
    FloatValueNode {
        loc: Some(node.loc()),
        value: value.to_string(),
    }
}

pub fn int(node: TsLocatableNode, value: &str) -> IntValueNode {
    IntValueNode {
        loc: Some(node.loc()),
        value: value.to_string(),
    }
}

pub fn null(node: TsLocatableNode) -> NullValueNode {
    NullValueNode {
        loc: Some(node.loc()),
    }
}

pub fn boolean(node: TsLocatableNode, value: bool) -> BooleanValueNode {
    BooleanValueNode {
        loc: Some(node.loc()),
        value,
    }
}

pub fn r#enum(node: TsLocatableNode, value: &str) -> EnumValueNode {
    EnumValueNode {
        loc: Some(node.loc()),
        value: value.to_string(),
    }
}

fn optional_list<T>(input: Option<Vec<T>>) -> Option<Vec<T>> {
    match input {
        Some(input) if !input.is_empty() => Some(input),
        _ => None,
    }
}

pub fn nullable_type(r#type: TypeNode) -> NullableTypeNode {
    match r#type {
        TypeNode::NonNullType(t) => *t.r#type,
        TypeNode::NamedType(t) => NullableTypeNode::NamedType(t),
        TypeNode::ListType(t) => NullableTypeNode::ListType(t),
    }
}
