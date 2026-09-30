//! Port of graphql-js `validation/ValidationContext.ts`.
//!
//! PORT: Only `ValidationContext`'s members which ported rules use.

use std::cell::RefCell;

use crate::error::graphql_error::GraphQLError;
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
