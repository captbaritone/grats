//! Port of graphql-js `utilities/TypeInfo.ts`.
//!
//! PORT: Only type system documents are visited (see `ast.rs`), so only the
//! state which they can set is tracked: the directive, and the input types of
//! directive arguments. Of that state, only what ported code reads is tracked,
//! so the argument, enum value and default values are not.

use std::cell::RefCell;

use crate::language::ast::ConstValueNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::r#type::definition::{GraphQLNamedType, GraphQLType};
use crate::r#type::directives::GraphQLDirective;
use crate::r#type::schema::GraphQLSchema;

/// TypeInfo is a utility class which, given a GraphQL schema, can keep track
/// of the current field and type definitions at any point in a GraphQL document
/// AST during a recursive descent by calling `enter(node)` and `leave(node)`.
pub struct TypeInfo<'s, 'a> {
    schema: &'s GraphQLSchema<'a>,
    input_type_stack: Vec<Option<&'s GraphQLType>>,
    directive: Option<&'s GraphQLDirective<'a>>,
}

impl<'s, 'a> TypeInfo<'s, 'a> {
    pub fn new(schema: &'s GraphQLSchema<'a>) -> Self {
        TypeInfo {
            schema,
            input_type_stack: Vec::new(),
            directive: None,
        }
    }

    pub fn get_input_type(&self) -> Option<&'s GraphQLType> {
        self.input_type_stack.last().copied().flatten()
    }

    pub fn get_parent_input_type(&self) -> Option<&'s GraphQLType> {
        let len = self.input_type_stack.len();
        if len < 2 {
            return None;
        }
        self.input_type_stack[len - 2]
    }

    pub fn get_directive(&self) -> Option<&'s GraphQLDirective<'a>> {
        self.directive
    }

    pub fn enter(&mut self, node: ASTNode) {
        let schema = self.schema;
        let is_input_type = |r#type: &GraphQLType| r#type.is_input_type(schema.arena());

        match node {
            ASTNode::Directive(node) => {
                self.directive = schema.get_directive(&node.name.value);
            }
            ASTNode::Argument(node) => {
                let mut arg_type = None;
                // PORT: graphql-js falls back to `this.getFieldDef()`, which is
                // only set within the fields of executable documents.
                let field_or_directive = self.get_directive();
                if let Some(field_or_directive) = field_or_directive {
                    let arg_def = field_or_directive
                        .args
                        .iter()
                        .find(|arg| arg.name == node.name.value);
                    if let Some(arg_def) = arg_def {
                        arg_type = Some(&arg_def.r#type);
                    }
                }
                self.input_type_stack
                    .push(arg_type.filter(|t| is_input_type(t)));
            }
            ASTNode::ConstValue(ConstValueNode::ListValue(_)) => {
                let list_type = self.get_input_type().map(GraphQLType::get_nullable_type);
                let item_type = match list_type {
                    Some(GraphQLType::List(of_type)) => Some(&**of_type),
                    list_type => list_type,
                };
                // List positions never have a default value.
                self.input_type_stack
                    .push(item_type.filter(|t| is_input_type(t)));
            }
            ASTNode::ObjectField(node) => {
                let object_type = self.get_input_type().map(|t| &schema[t.get_named_type()]);
                let mut input_field_type = None;
                if let Some(GraphQLNamedType::InputObject(object_type)) = object_type {
                    let input_field = object_type.get_fields().get(node.name.value.as_str());
                    if let Some(input_field) = input_field {
                        input_field_type = Some(&input_field.r#type);
                    }
                }
                self.input_type_stack
                    .push(input_field_type.filter(|t| is_input_type(t)));
            }
            // Ignore other nodes
            _ => {}
        }
    }

    pub fn leave(&mut self, node: ASTNode) {
        match node {
            ASTNode::Directive(_) => {
                self.directive = None;
            }
            ASTNode::Argument(_) => {
                self.input_type_stack.pop();
            }
            ASTNode::ConstValue(ConstValueNode::ListValue(_)) | ASTNode::ObjectField(_) => {
                self.input_type_stack.pop();
            }
            // Ignore other nodes
            _ => {}
        }
    }
}

/// Creates a new visitor instance which maintains a provided TypeInfo instance
/// along with visiting visitor.
///
/// PORT: The visitor reads the `TypeInfo` while this updates it, so they share
/// it through a `RefCell`.
pub fn visit_with_type_info<'t, 's, 'a, V>(
    type_info: &'t RefCell<TypeInfo<'s, 'a>>,
    visitor: V,
) -> VisitWithTypeInfo<'t, 's, 'a, V> {
    VisitWithTypeInfo { type_info, visitor }
}

pub struct VisitWithTypeInfo<'t, 's, 'a, V> {
    type_info: &'t RefCell<TypeInfo<'s, 'a>>,
    visitor: V,
}

impl<'n, V: ASTVisitor<'n>> ASTVisitor<'n> for VisitWithTypeInfo<'_, '_, '_, V> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        self.type_info.borrow_mut().enter(node);
        // PORT: graphql-js only calls the visitor if it has a function for the
        // node's kind. Here visitors ignore nodes by default.
        let result = self.visitor.enter(node);
        if result != VisitAction::Continue {
            self.type_info.borrow_mut().leave(node);
        }
        result
    }

    fn leave(&mut self, node: ASTNode<'n>) {
        self.visitor.leave(node);
        self.type_info.borrow_mut().leave(node);
    }
}
