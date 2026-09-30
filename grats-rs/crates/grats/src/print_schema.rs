//! Port of `src/printSchema.ts`.
//!
//! PORT: Only `printSDLWithoutMetadata` is ported so far. The other functions
//! move once the output stage is in Rust.

use graphql_js::language::ast::{DefinitionNode, DocumentNode};
use graphql_js::language::printer::print;
use graphql_js::r#type::scalars::specified_scalar_types;

use crate::utils::visitor::map_definitions;

pub fn print_sdl_without_metadata(doc: DocumentNode) -> String {
    let trimmed = map_definitions(doc, |def| match def {
        DefinitionNode::ScalarTypeDefinition(t)
            if specified_scalar_types()
                .iter()
                .any(|scalar| scalar.name == t.name.value) =>
        {
            None
        }
        def => Some(def),
    });
    print(&trimmed)
}
