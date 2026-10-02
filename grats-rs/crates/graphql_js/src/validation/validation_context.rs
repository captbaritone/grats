//! Port of graphql-js `validation/ValidationContext.ts`.
//!
//! PORT: Only the members which ported rules use.

use std::cell::RefCell;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::DocumentNode;
use crate::language::visitor::ASTVisitor;
use crate::r#type::definition::GraphQLType;
use crate::r#type::schema::GraphQLSchema;
use crate::utilities::type_info::TypeInfo;

/// PORT: graphql-js also takes the document, which ported rules don't read.
pub struct ValidationContext<'c, 's, 'a> {
    schema: &'s GraphQLSchema<'a>,
    type_info: &'c RefCell<TypeInfo<'s, 'a>>,
    on_error: &'c mut dyn FnMut(GraphQLError),
}

impl<'c, 's, 'a> ValidationContext<'c, 's, 'a> {
    pub fn new(
        schema: &'s GraphQLSchema<'a>,
        type_info: &'c RefCell<TypeInfo<'s, 'a>>,
        on_error: &'c mut dyn FnMut(GraphQLError),
    ) -> Self {
        ValidationContext {
            schema,
            type_info,
            on_error,
        }
    }

    pub fn report_error(&mut self, error: GraphQLError) {
        (self.on_error)(error);
    }

    pub fn get_schema(&self) -> &'s GraphQLSchema<'a> {
        self.schema
    }

    pub fn get_input_type(&self) -> Option<&'s GraphQLType> {
        self.type_info.borrow().get_input_type()
    }

    pub fn get_parent_input_type(&self) -> Option<&'s GraphQLType> {
        self.type_info.borrow().get_parent_input_type()
    }
}

/// PORT: graphql-js's `SDLValidationContext` extends `ASTValidationContext`,
/// whose members are merged into it. graphql-js also takes the schema being
/// extended, which Grats never passes, so the context has no schema and ported
/// rules omit the checks against it. graphql-js reports errors to an `onError`
/// callback, which `validateSDL` uses to collect them. Here the context
/// collects them, in a `RefCell` since every rule holds a reference to it.
pub struct SDLValidationContext<'n> {
    ast: &'n DocumentNode,
    errors: RefCell<Vec<GraphQLError>>,
}

impl<'n> SDLValidationContext<'n> {
    pub fn new(ast: &'n DocumentNode) -> Self {
        SDLValidationContext {
            ast,
            errors: RefCell::new(Vec::new()),
        }
    }

    pub fn report_error(&self, error: GraphQLError) {
        self.errors.borrow_mut().push(error);
    }

    pub fn get_document(&self) -> &'n DocumentNode {
        self.ast
    }

    /// PORT: The errors which were reported, which graphql-js collects in
    /// `validateSDL`'s `onError` callback.
    pub fn into_errors(self) -> Vec<GraphQLError> {
        self.errors.into_inner()
    }
}

/// PORT: graphql-js rules return visitors of any shape. Here each returns a
/// boxed `ASTVisitor`.
pub type SDLValidationRule =
    for<'c, 'n> fn(&'c SDLValidationContext<'n>) -> Box<dyn ASTVisitor<'n> + 'c>;
