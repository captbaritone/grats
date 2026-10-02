use std::cmp::Ordering;

use graphql_js::language::ast::{
    ConstArgumentNode, ConstDirectiveNode, DefinitionNode, DocumentNode, EnumValueDefinitionNode,
    FieldDefinitionNode, InputValueDefinitionNode, NameNode, NamedTypeNode,
};

use graphql_js::jsutils::natural_compare::natural_compare;

/// Similar to lexicographicSortSchema from graphql-js but applied against an AST
/// instead of a `GraphQLSchema`. Note that this creates some subtle differences,
/// such as the presence of schema directives, which are not preserved in a
/// `GraphQLSchema`.
pub fn sort_schema_ast(mut doc: DocumentNode) -> DocumentNode {
    doc.definitions.sort_by(|a, b| {
        kind_sort_order(a)
            .cmp(&kind_sort_order(b))
            .then_with(|| compare_by_name(a, b))
    });
    for definition in &mut doc.definitions {
        sort_definition(definition);
    }
    doc
}

fn sort_definition(definition: &mut DefinitionNode) {
    match definition {
        DefinitionNode::ScalarTypeDefinition(t) => {
            sort_named(&mut t.directives);
            sort_directives(&mut t.directives);
        }
        DefinitionNode::ObjectTypeDefinition(t) => {
            sort_named(&mut t.directives);
            sort_named(&mut t.interfaces);
            sort_named(&mut t.fields);
            sort_directives(&mut t.directives);
            sort_field_definitions(&mut t.fields);
        }
        DefinitionNode::InterfaceTypeDefinition(t) => {
            sort_named(&mut t.directives);
            sort_named(&mut t.interfaces);
            sort_named(&mut t.fields);
            sort_directives(&mut t.directives);
            sort_field_definitions(&mut t.fields);
        }
        DefinitionNode::UnionTypeDefinition(t) => {
            sort_named(&mut t.directives);
            sort_named(&mut t.types);
            sort_directives(&mut t.directives);
        }
        DefinitionNode::EnumTypeDefinition(t) => {
            sort_named(&mut t.directives);
            sort_named(&mut t.values);
            sort_directives(&mut t.directives);
            sort_enum_value_definitions(&mut t.values);
        }
        DefinitionNode::InputObjectTypeDefinition(t) => {
            sort_named(&mut t.directives);
            sort_named(&mut t.fields);
            sort_directives(&mut t.directives);
            sort_input_value_definitions(&mut t.fields);
        }
        DefinitionNode::DirectiveDefinition(t) => {
            sort_input_value_definitions(&mut t.arguments);
        }
        DefinitionNode::SchemaDefinition(t) => {
            sort_directives(&mut t.directives);
        }
        DefinitionNode::SchemaExtension(t) => {
            sort_directives(&mut t.directives);
        }
        DefinitionNode::ScalarTypeExtension(t) => {
            sort_directives(&mut t.directives);
        }
        DefinitionNode::ObjectTypeExtension(t) => {
            sort_directives(&mut t.directives);
            sort_field_definitions(&mut t.fields);
        }
        DefinitionNode::InterfaceTypeExtension(t) => {
            sort_directives(&mut t.directives);
            sort_field_definitions(&mut t.fields);
        }
        DefinitionNode::UnionTypeExtension(t) => {
            sort_directives(&mut t.directives);
        }
        DefinitionNode::EnumTypeExtension(t) => {
            sort_directives(&mut t.directives);
            sort_enum_value_definitions(&mut t.values);
        }
        DefinitionNode::InputObjectTypeExtension(t) => {
            sort_directives(&mut t.directives);
            sort_input_value_definitions(&mut t.fields);
        }
    }
}

// FieldDefinition
fn sort_field_definitions(nodes: &mut Option<Vec<FieldDefinitionNode>>) {
    for t in nodes.iter_mut().flatten() {
        sort_named(&mut t.directives);
        sort_named(&mut t.arguments);
        sort_directives(&mut t.directives);
        sort_input_value_definitions(&mut t.arguments);
    }
}

// InputValueDefinition
fn sort_input_value_definitions(nodes: &mut Option<Vec<InputValueDefinitionNode>>) {
    for t in nodes.iter_mut().flatten() {
        sort_named(&mut t.directives);
        sort_directives(&mut t.directives);
    }
}

fn sort_enum_value_definitions(nodes: &mut Option<Vec<EnumValueDefinitionNode>>) {
    for t in nodes.iter_mut().flatten() {
        sort_directives(&mut t.directives);
    }
}

// Directive
fn sort_directives(nodes: &mut Option<Vec<ConstDirectiveNode>>) {
    for t in nodes.iter_mut().flatten() {
        sort_named(&mut t.arguments);
    }
}

trait Named {
    fn name(&self) -> Option<&NameNode>;
}

macro_rules! impl_named {
    ($($node:ty),* $(,)?) => {
        $(impl Named for $node {
            fn name(&self) -> Option<&NameNode> {
                Some(&self.name)
            }
        })*
    };
}

impl_named!(
    ConstDirectiveNode,
    ConstArgumentNode,
    NamedTypeNode,
    FieldDefinitionNode,
    InputValueDefinitionNode,
    EnumValueDefinitionNode,
);

impl Named for DefinitionNode {
    fn name(&self) -> Option<&NameNode> {
        match self {
            DefinitionNode::SchemaDefinition(_) | DefinitionNode::SchemaExtension(_) => None,
            DefinitionNode::ScalarTypeDefinition(t) => Some(&t.name),
            DefinitionNode::ObjectTypeDefinition(t) => Some(&t.name),
            DefinitionNode::InterfaceTypeDefinition(t) => Some(&t.name),
            DefinitionNode::UnionTypeDefinition(t) => Some(&t.name),
            DefinitionNode::EnumTypeDefinition(t) => Some(&t.name),
            DefinitionNode::InputObjectTypeDefinition(t) => Some(&t.name),
            DefinitionNode::DirectiveDefinition(t) => Some(&t.name),
            DefinitionNode::ScalarTypeExtension(t) => Some(&t.name),
            DefinitionNode::ObjectTypeExtension(t) => Some(&t.name),
            DefinitionNode::InterfaceTypeExtension(t) => Some(&t.name),
            DefinitionNode::UnionTypeExtension(t) => Some(&t.name),
            DefinitionNode::EnumTypeExtension(t) => Some(&t.name),
            DefinitionNode::InputObjectTypeExtension(t) => Some(&t.name),
        }
    }
}

// Given an optional array of AST nodes, sort them by name.
fn sort_named<T: Named>(nodes: &mut Option<Vec<T>>) {
    if let Some(nodes) = nodes {
        nodes.sort_by(compare_by_name);
    }
}

// Note that we use `naturalCompare` here instead of `localeCompare`. This has
// three motivations:
//
// * It matches the behavior of `lexicographicSortSchema` from graphql-js.
// * It's stable across locales so users in different locales won't generate
//   different outputs from the same input resulting in unnecessary diffs.
// * It's likely a more user-friendly sort order than simple > or <.
fn compare_by_name<T: Named>(a: &T, b: &T) -> Ordering {
    match (a.name(), b.name()) {
        // Only schema definitions and extensions are unnamed, and
        // `kind_sort_order` already orders them.
        (None, None) => Ordering::Equal,
        // Unnamed things go first
        (None, Some(_)) => Ordering::Less,
        (Some(_), None) => Ordering::Greater,
        (Some(a_name), Some(b_name)) => natural_compare(&a_name.value, &b_name.value),
    }
}

fn kind_sort_order(def: &DefinitionNode) -> u8 {
    match def {
        DefinitionNode::DirectiveDefinition(_) => 0,
        DefinitionNode::SchemaDefinition(_) => 1,
        DefinitionNode::ScalarTypeDefinition(_) => 2,
        DefinitionNode::ScalarTypeExtension(_) => 3,
        DefinitionNode::EnumTypeDefinition(_) => 4,
        DefinitionNode::EnumTypeExtension(_) => 5,
        DefinitionNode::UnionTypeDefinition(_) => 6,
        DefinitionNode::UnionTypeExtension(_) => 7,
        DefinitionNode::InterfaceTypeDefinition(_) => 8,
        DefinitionNode::InterfaceTypeExtension(_) => 9,
        DefinitionNode::InputObjectTypeDefinition(_) => 10,
        DefinitionNode::InputObjectTypeExtension(_) => 11,
        DefinitionNode::ObjectTypeDefinition(_) => 12,
        DefinitionNode::ObjectTypeExtension(_) => 13,
        DefinitionNode::SchemaExtension(_) => 14,
    }
}
