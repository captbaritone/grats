//! Port of `src/GraphQLConstructor.ts`.
//!
//! PORT: The TypeScript class's methods which don't create nodes located at
//! TypeScript nodes are free functions. Optional parameters and `null`s are
//! `Option`s.

use graphql_js::language::ast::{
    BooleanValueNode, ConstArgumentNode, ConstDirectiveNode, ConstListValueNode,
    ConstObjectFieldNode, ConstObjectValueNode, ConstValueNode, DiagnosticHandleResult,
    DirectiveDefinitionNode, EnumTypeDefinitionNode, EnumValueDefinitionNode, EnumValueNode,
    ExportDefinition, FieldDefinitionNode, FloatValueNode, InputObjectTypeDefinitionNode,
    InputValueDefinitionNode, InputValueDefinitionNodeOrResolverArg, IntValueNode,
    InterfaceTypeDefinitionNode, ListTypeNode, Location, NameNode, NamedTypeNode, NonNullTypeNode,
    NullValueNode, NullableTypeNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode,
    ResolverSignature, ScalarTypeDefinitionNode, StringValueNode, TypeNode,
    UnionTypeDefinitionNode,
};

use crate::utils::diagnostic_error::TsLocatableNode;
use crate::utils::helpers::unique_id;

pub struct GraphQLConstructor;

impl GraphQLConstructor {
    /* Top Level Types */
    pub fn directive_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        args: Option<Vec<InputValueDefinitionNode>>,
        repeatable: bool,
        locations: Vec<NameNode>,
        description: Option<StringValueNode>,
    ) -> DirectiveDefinitionNode {
        DirectiveDefinitionNode {
            loc: Some(loc(node)),
            name,
            arguments: optional_list(args),
            repeatable,
            locations,
            description,
        }
    }

    pub fn union_type_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        types: Vec<NamedTypeNode>,
        description: Option<StringValueNode>,
        directives: Option<Vec<ConstDirectiveNode>>,
    ) -> UnionTypeDefinitionNode {
        UnionTypeDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            types: Some(types),
            directives: optional_list(directives),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn object_type_definition(
        &self,
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
            loc: Some(loc(node)),
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
        &self,
        node: TsLocatableNode,
        name: NameNode,
        fields: Vec<FieldDefinitionNode>,
        interfaces: Option<Vec<NamedTypeNode>>,
        description: Option<StringValueNode>,
        directives: Option<Vec<ConstDirectiveNode>>,
    ) -> InterfaceTypeDefinitionNode {
        InterfaceTypeDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            fields: Some(fields),
            interfaces,
            directives: optional_list(directives),
        }
    }

    pub fn enum_type_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        values: Vec<EnumValueDefinitionNode>,
        description: Option<StringValueNode>,
        directives: Option<Vec<ConstDirectiveNode>>,
        exported: Option<ExportDefinition>,
    ) -> EnumTypeDefinitionNode {
        EnumTypeDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            values: Some(values),
            directives: optional_list(directives),
            exported,
        }
    }

    /* Top Level Extensions */

    pub fn abstract_field_definition(
        &self,
        node: TsLocatableNode,
        on_type: NameNode,
        field: FieldDefinitionNode,
        may_be_interface: bool,
    ) -> ObjectTypeExtensionNode {
        ObjectTypeExtensionNode {
            loc: Some(loc(node)),
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
        &self,
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
            loc: Some(loc(node)),
            description,
            name,
            r#type,
            arguments: args,
            directives: optional_list(Some(directives)),
            resolver: Some(resolver),
            kills_parent_on_exception,
        }
    }

    pub fn const_object_field(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        value: ConstValueNode,
    ) -> ConstObjectFieldNode {
        ConstObjectFieldNode {
            loc: Some(loc(node)),
            name,
            value,
        }
    }

    pub fn input_value_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        r#type: TypeNode,
        directives: Option<Vec<ConstDirectiveNode>>,
        default_value: Option<ConstValueNode>,
        description: Option<StringValueNode>,
    ) -> InputValueDefinitionNode {
        InputValueDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            r#type,
            default_value,
            directives: optional_list(directives),
        }
    }

    pub fn input_value_definition_or_resolver_arg(
        &self,
        node: TsLocatableNode,
        name: DiagnosticHandleResult<NameNode>,
        r#type: TypeNode,
        directives: Option<Vec<ConstDirectiveNode>>,
        default_value: Option<ConstValueNode>,
        description: Option<StringValueNode>,
    ) -> InputValueDefinitionNodeOrResolverArg {
        InputValueDefinitionNodeOrResolverArg {
            loc: Some(loc(node)),
            description,
            name,
            r#type,
            default_value,
            directives: optional_list(directives),
        }
    }

    pub fn enum_value_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        directives: Option<Vec<ConstDirectiveNode>>,
        description: Option<StringValueNode>,
        ts_name: Option<String>,
    ) -> EnumValueDefinitionNode {
        EnumValueDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            directives,
            ts_name,
        }
    }

    pub fn scalar_type_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        directives: Option<Vec<ConstDirectiveNode>>,
        description: Option<StringValueNode>,
        exported: Option<ExportDefinition>,
    ) -> ScalarTypeDefinitionNode {
        ScalarTypeDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            directives: optional_list(directives),
            exported,
        }
    }

    pub fn input_object_type_definition(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        fields: Option<Vec<InputValueDefinitionNode>>,
        directives: Option<Vec<ConstDirectiveNode>>,
        description: Option<StringValueNode>,
    ) -> InputObjectTypeDefinitionNode {
        InputObjectTypeDefinitionNode {
            loc: Some(loc(node)),
            description,
            name,
            fields,
            directives: optional_list(directives),
        }
    }

    /* Primitives */
    pub fn name(&self, node: TsLocatableNode, value: &str) -> NameNode {
        NameNode {
            loc: Some(loc(node)),
            value: value.to_string(),
            ts_identifier: unique_id(),
        }
    }

    pub fn named_type(&self, node: TsLocatableNode, value: &str) -> NamedTypeNode {
        NamedTypeNode {
            loc: Some(loc(node)),
            name: self.name(node, value),
        }
    }

    pub fn object(
        &self,
        node: TsLocatableNode,
        fields: Vec<ConstObjectFieldNode>,
    ) -> ConstObjectValueNode {
        ConstObjectValueNode {
            loc: Some(loc(node)),
            fields,
        }
    }

    /* Helpers */
    pub fn non_null_type(&self, node: TsLocatableNode, r#type: TypeNode) -> TypeNode {
        let r#type = match r#type {
            TypeNode::NonNullType(_) => return r#type,
            TypeNode::NamedType(t) => NullableTypeNode::NamedType(t),
            TypeNode::ListType(t) => NullableTypeNode::ListType(t),
        };
        TypeNode::NonNullType(NonNullTypeNode {
            loc: Some(loc(node)),
            r#type: Box::new(r#type),
        })
    }

    pub fn nullable_type(&self, r#type: TypeNode) -> NullableTypeNode {
        nullable_type(r#type)
    }

    pub fn list_type(&self, node: TsLocatableNode, r#type: TypeNode) -> ListTypeNode {
        ListTypeNode {
            loc: Some(loc(node)),
            r#type: Box::new(r#type),
            is_async_iterable: false,
        }
    }

    pub fn list(&self, node: TsLocatableNode, values: Vec<ConstValueNode>) -> ConstListValueNode {
        ConstListValueNode {
            loc: Some(loc(node)),
            values,
        }
    }

    /// PORT: Only used with nullable types.
    pub fn with_location(&self, node: TsLocatableNode, value: NullableTypeNode) -> TypeNode {
        match value {
            NullableTypeNode::NamedType(t) => TypeNode::NamedType(NamedTypeNode {
                loc: Some(loc(node)),
                ..t
            }),
            NullableTypeNode::ListType(t) => TypeNode::ListType(ListTypeNode {
                loc: Some(loc(node)),
                ..t
            }),
        }
    }

    pub fn const_argument(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        value: ConstValueNode,
    ) -> ConstArgumentNode {
        ConstArgumentNode {
            loc: Some(loc(node)),
            name,
            value,
        }
    }

    /// PORT: `isAmbiguous` isn't modeled.
    pub fn const_directive(
        &self,
        node: TsLocatableNode,
        name: NameNode,
        args: Option<Vec<ConstArgumentNode>>,
    ) -> ConstDirectiveNode {
        ConstDirectiveNode {
            loc: Some(loc(node)),
            name,
            arguments: optional_list(args),
        }
    }

    pub fn string(
        &self,
        node: TsLocatableNode,
        value: &str,
        block: Option<bool>,
    ) -> StringValueNode {
        StringValueNode {
            loc: Some(loc(node)),
            value: value.to_string(),
            block: block.unwrap_or(false),
        }
    }

    pub fn float(&self, node: TsLocatableNode, value: &str) -> FloatValueNode {
        FloatValueNode {
            loc: Some(loc(node)),
            value: value.to_string(),
        }
    }

    pub fn int(&self, node: TsLocatableNode, value: &str) -> IntValueNode {
        IntValueNode {
            loc: Some(loc(node)),
            value: value.to_string(),
        }
    }

    pub fn null(&self, node: TsLocatableNode) -> NullValueNode {
        NullValueNode {
            loc: Some(loc(node)),
        }
    }

    pub fn boolean(&self, node: TsLocatableNode, value: bool) -> BooleanValueNode {
        BooleanValueNode {
            loc: Some(loc(node)),
            value,
        }
    }

    pub fn r#enum(&self, node: TsLocatableNode, value: &str) -> EnumValueNode {
        EnumValueNode {
            loc: Some(loc(node)),
            value: value.to_string(),
        }
    }
}

fn optional_list<T>(input: Option<Vec<T>>) -> Option<Vec<T>> {
    match input {
        Some(input) if !input.is_empty() => Some(input),
        _ => None,
    }
}

pub fn nullable_type(r#type: TypeNode) -> NullableTypeNode {
    let mut inner = r#type;
    loop {
        match inner {
            TypeNode::NonNullType(t) => inner = (*t.r#type).into(),
            TypeNode::NamedType(t) => return NullableTypeNode::NamedType(t),
            TypeNode::ListType(t) => return NullableTypeNode::ListType(t),
        }
    }
}

/// PORT: TypeScript's version computes line and column info, which is
/// derived from offsets when needed.
pub fn loc(node: TsLocatableNode) -> Location {
    node.loc()
}
