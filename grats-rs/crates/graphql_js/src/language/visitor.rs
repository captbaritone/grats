//! Port of graphql-js `language/visitor.ts`.
//!
//! PORT: graphql-js visits any node generically, by reading each node kind's
//! child keys from `QueryDocumentKeys`. Here `ASTNode` references a node of
//! any kind, and `visit_children` lists each kind's children in the order of
//! its `QueryDocumentKeys` entry. Only the type system subset of the AST is
//! ported (see `ast.rs`), and visitors can only skip a node's children, not
//! stop the visit or edit the AST.

use super::ast::*;

/// A reference to a node of any kind.
///
/// PORT: Values are visited as `ConstValueNode`s, rather than one variant per
/// value kind, so that visitors can pass them to functions which take any
/// value, like `print`. Descriptions are the only `StringValue` nodes which
/// aren't in a value position, and are visited as `Description`.
#[derive(Debug, Clone, Copy)]
pub enum ASTNode<'n> {
    Name(&'n NameNode),
    Document(&'n DocumentNode),
    Argument(&'n ConstArgumentNode),
    ConstValue(&'n ConstValueNode),
    Description(&'n StringValueNode),
    ObjectField(&'n ConstObjectFieldNode),
    Directive(&'n ConstDirectiveNode),
    NamedType(&'n NamedTypeNode),
    ListType(&'n ListTypeNode),
    NonNullType(&'n NonNullTypeNode),
    SchemaDefinition(&'n SchemaDefinitionNode),
    OperationTypeDefinition(&'n OperationTypeDefinitionNode),
    ScalarTypeDefinition(&'n ScalarTypeDefinitionNode),
    ObjectTypeDefinition(&'n ObjectTypeDefinitionNode),
    FieldDefinition(&'n FieldDefinitionNode),
    InputValueDefinition(&'n InputValueDefinitionNode),
    InterfaceTypeDefinition(&'n InterfaceTypeDefinitionNode),
    UnionTypeDefinition(&'n UnionTypeDefinitionNode),
    EnumTypeDefinition(&'n EnumTypeDefinitionNode),
    EnumValueDefinition(&'n EnumValueDefinitionNode),
    InputObjectTypeDefinition(&'n InputObjectTypeDefinitionNode),
    DirectiveDefinition(&'n DirectiveDefinitionNode),
    SchemaExtension(&'n SchemaExtensionNode),
    ScalarTypeExtension(&'n ScalarTypeExtensionNode),
    ObjectTypeExtension(&'n ObjectTypeExtensionNode),
    InterfaceTypeExtension(&'n InterfaceTypeExtensionNode),
    UnionTypeExtension(&'n UnionTypeExtensionNode),
    EnumTypeExtension(&'n EnumTypeExtensionNode),
    InputObjectTypeExtension(&'n InputObjectTypeExtensionNode),
}

/// PORT: What a visitor's `enter` returns. graphql-js visitors return
/// `undefined` to continue and `false` to skip the node's children.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VisitAction {
    Continue,
    Skip,
}

/// A visitor is provided to visit, it contains the collection of relevant
/// functions to be called during the visitor's traversal.
///
/// PORT: graphql-js visitors provide functions per node kind. Here a visitor
/// receives every node and matches on its kind.
pub trait ASTVisitor<'n> {
    fn enter(&mut self, _node: ASTNode<'n>) -> VisitAction {
        VisitAction::Continue
    }

    fn leave(&mut self, _node: ASTNode<'n>) {}
}

/// visit() will walk through an AST using a depth-first traversal, calling
/// the visitor's enter function at each node in the traversal, and calling the
/// leave function after visiting that node and all of its child nodes.
///
/// By returning different values from the enter and leave functions, the
/// behavior of the visitor can be altered, including skipping over a sub-tree of
/// the AST (by returning false).
pub fn visit<'n>(root: &'n DocumentNode, visitor: &mut impl ASTVisitor<'n>) {
    visit_node(ASTNode::Document(root), visitor);
}

fn visit_node<'n>(node: ASTNode<'n>, visitor: &mut impl ASTVisitor<'n>) {
    if visitor.enter(node) == VisitAction::Skip {
        return;
    }
    visit_children(node, &mut |child| visit_node(child, visitor));
    visitor.leave(node);
}

/// PORT: `QueryDocumentKeys`, as a function which passes each child of a node
/// to `f`, in order.
fn visit_children<'n>(node: ASTNode<'n>, f: &mut dyn FnMut(ASTNode<'n>)) {
    fn each<'n, T>(
        nodes: &'n Option<Vec<T>>,
        f: &mut dyn FnMut(ASTNode<'n>),
        wrap: fn(&'n T) -> ASTNode<'n>,
    ) {
        for node in nodes.iter().flatten() {
            f(wrap(node));
        }
    }
    fn description<'n>(node: &'n Option<StringValueNode>, f: &mut dyn FnMut(ASTNode<'n>)) {
        if let Some(node) = node {
            f(ASTNode::Description(node));
        }
    }
    fn r#type<'n>(node: &'n TypeNode, f: &mut dyn FnMut(ASTNode<'n>)) {
        f(match node {
            TypeNode::NamedType(node) => ASTNode::NamedType(node),
            TypeNode::ListType(node) => ASTNode::ListType(node),
            TypeNode::NonNullType(node) => ASTNode::NonNullType(node),
        });
    }
    let directives = ASTNode::Directive;
    let named_type = ASTNode::NamedType;

    match node {
        ASTNode::Name(_) => {}
        ASTNode::Document(node) => {
            for definition in &node.definitions {
                f(definition_node(definition));
            }
        }
        ASTNode::Argument(node) => {
            f(ASTNode::Name(&node.name));
            f(ASTNode::ConstValue(&node.value));
        }
        ASTNode::ConstValue(node) => match node {
            ConstValueNode::ListValue(node) => {
                for value in &node.values {
                    f(ASTNode::ConstValue(value));
                }
            }
            ConstValueNode::ObjectValue(node) => {
                for field in &node.fields {
                    f(ASTNode::ObjectField(field));
                }
            }
            _ => {}
        },
        ASTNode::Description(_) => {}
        ASTNode::ObjectField(node) => {
            f(ASTNode::Name(&node.name));
            f(ASTNode::ConstValue(&node.value));
        }
        ASTNode::Directive(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.arguments, f, ASTNode::Argument);
        }
        ASTNode::NamedType(node) => f(ASTNode::Name(&node.name)),
        ASTNode::ListType(node) => r#type(&node.r#type, f),
        ASTNode::NonNullType(node) => f(match &*node.r#type {
            NullableTypeNode::NamedType(node) => ASTNode::NamedType(node),
            NullableTypeNode::ListType(node) => ASTNode::ListType(node),
        }),
        ASTNode::SchemaDefinition(node) => {
            description(&node.description, f);
            each(&node.directives, f, directives);
            for operation_type in &node.operation_types {
                f(ASTNode::OperationTypeDefinition(operation_type));
            }
        }
        ASTNode::OperationTypeDefinition(node) => f(ASTNode::NamedType(&node.r#type)),
        ASTNode::ScalarTypeDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
        }
        ASTNode::ObjectTypeDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.interfaces, f, named_type);
            each(&node.directives, f, directives);
            each(&node.fields, f, ASTNode::FieldDefinition);
        }
        ASTNode::FieldDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.arguments, f, ASTNode::InputValueDefinition);
            r#type(&node.r#type, f);
            each(&node.directives, f, directives);
        }
        ASTNode::InputValueDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            r#type(&node.r#type, f);
            if let Some(default_value) = &node.default_value {
                f(ASTNode::ConstValue(default_value));
            }
            each(&node.directives, f, directives);
        }
        ASTNode::InterfaceTypeDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.interfaces, f, named_type);
            each(&node.directives, f, directives);
            each(&node.fields, f, ASTNode::FieldDefinition);
        }
        ASTNode::UnionTypeDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
            each(&node.types, f, named_type);
        }
        ASTNode::EnumTypeDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
            each(&node.values, f, ASTNode::EnumValueDefinition);
        }
        ASTNode::EnumValueDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
        }
        ASTNode::InputObjectTypeDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
            each(&node.fields, f, ASTNode::InputValueDefinition);
        }
        ASTNode::DirectiveDefinition(node) => {
            description(&node.description, f);
            f(ASTNode::Name(&node.name));
            each(&node.arguments, f, ASTNode::InputValueDefinition);
            for location in &node.locations {
                f(ASTNode::Name(location));
            }
        }
        ASTNode::SchemaExtension(node) => {
            each(&node.directives, f, directives);
            each(&node.operation_types, f, ASTNode::OperationTypeDefinition);
        }
        ASTNode::ScalarTypeExtension(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
        }
        ASTNode::ObjectTypeExtension(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.interfaces, f, named_type);
            each(&node.directives, f, directives);
            each(&node.fields, f, ASTNode::FieldDefinition);
        }
        ASTNode::InterfaceTypeExtension(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.interfaces, f, named_type);
            each(&node.directives, f, directives);
            each(&node.fields, f, ASTNode::FieldDefinition);
        }
        ASTNode::UnionTypeExtension(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
            each(&node.types, f, named_type);
        }
        ASTNode::EnumTypeExtension(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
            each(&node.values, f, ASTNode::EnumValueDefinition);
        }
        ASTNode::InputObjectTypeExtension(node) => {
            f(ASTNode::Name(&node.name));
            each(&node.directives, f, directives);
            each(&node.fields, f, ASTNode::InputValueDefinition);
        }
    }
}

fn definition_node(node: &DefinitionNode) -> ASTNode<'_> {
    match node {
        DefinitionNode::SchemaDefinition(node) => ASTNode::SchemaDefinition(node),
        DefinitionNode::ScalarTypeDefinition(node) => ASTNode::ScalarTypeDefinition(node),
        DefinitionNode::ObjectTypeDefinition(node) => ASTNode::ObjectTypeDefinition(node),
        DefinitionNode::InterfaceTypeDefinition(node) => ASTNode::InterfaceTypeDefinition(node),
        DefinitionNode::UnionTypeDefinition(node) => ASTNode::UnionTypeDefinition(node),
        DefinitionNode::EnumTypeDefinition(node) => ASTNode::EnumTypeDefinition(node),
        DefinitionNode::InputObjectTypeDefinition(node) => ASTNode::InputObjectTypeDefinition(node),
        DefinitionNode::DirectiveDefinition(node) => ASTNode::DirectiveDefinition(node),
        DefinitionNode::SchemaExtension(node) => ASTNode::SchemaExtension(node),
        DefinitionNode::ScalarTypeExtension(node) => ASTNode::ScalarTypeExtension(node),
        DefinitionNode::ObjectTypeExtension(node) => ASTNode::ObjectTypeExtension(node),
        DefinitionNode::InterfaceTypeExtension(node) => ASTNode::InterfaceTypeExtension(node),
        DefinitionNode::UnionTypeExtension(node) => ASTNode::UnionTypeExtension(node),
        DefinitionNode::EnumTypeExtension(node) => ASTNode::EnumTypeExtension(node),
        DefinitionNode::InputObjectTypeExtension(node) => ASTNode::InputObjectTypeExtension(node),
    }
}
