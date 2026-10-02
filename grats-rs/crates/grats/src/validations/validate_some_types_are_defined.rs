use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;

use crate::errors as E;
use crate::utils::diagnostic_error::{DiagnosticsResult, locationless_err};

/// We want to support a "getting started" experience where users can run `npx
/// grats` and let the error messages guide them to getting something working.
///
/// So, even though an empty schema is technically valid, we treat it as an error
/// so we can provide the user with a helpful message teaching them about defining
/// types.
pub fn validate_some_types_are_defined(schema: &GraphQLSchema<'_>) -> DiagnosticsResult<()> {
    let mut types = schema.get_type_map().values().map(|&id| &schema[id]);
    if types.any(is_user_defined_type) {
        Ok(())
    } else {
        Err(vec![locationless_err(E::no_types_defined())])
    }
}

fn is_user_defined_type(r#type: &GraphQLNamedType) -> bool {
    !r#type.name().starts_with("__")
}
