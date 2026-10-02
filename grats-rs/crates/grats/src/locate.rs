//! Finds where a type or field is defined, for `grats locate`.

use graphql_js::language::ast::{DocumentNode, Location, NameNode};
use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;

/// Builds the schema `doc` defines, and locates the entity in it. See
/// `locate`.
pub fn locate_in_document(doc: &DocumentNode, entity_name: &str) -> Result<Location, String> {
    locate(&build_ast_schema(doc), entity_name)
}

struct EntityName<'e> {
    parent: &'e str,
    field: Option<&'e str>,
}

/// Given an entity name of the format `ParentType` or `ParentType.fieldName`,
/// locate the entity in the schema and return its location.
fn locate(schema: &GraphQLSchema, entity_name: &str) -> Result<Location, String> {
    let entity = parse_entity_name(entity_name)?;
    let r#type = schema
        .get_type(entity.parent)
        .map(|id| &schema[id])
        .ok_or_else(|| format!("Cannot locate type `{}`.", entity.parent))?;
    let Some(field_name) = entity.field else {
        let name = type_name(r#type).unwrap_or_else(|| {
            panic!(
                "Grats bug: Cannot find location of type `{}`.",
                entity.parent
            )
        });
        return Ok(name.loc.expect("Expected name to have loc"));
    };

    // `None` if the type has no such field, and `Some(None)` if the field has
    // no definition.
    let field_name_node = match r#type {
        GraphQLNamedType::Object(t) => t
            .get_fields()
            .get(field_name)
            .map(|f| f.ast_node.map(|n| &n.name)),
        GraphQLNamedType::Interface(t) => t
            .get_fields()
            .get(field_name)
            .map(|f| f.ast_node.map(|n| &n.name)),
        GraphQLNamedType::InputObject(t) => t
            .get_fields()
            .get(field_name)
            .map(|f| f.ast_node.map(|n| &n.name)),
        _ => {
            return Err(format!(
                "Cannot locate field `{field_name}` on type `{}`. Only object types, interfaces, and input objects have fields.",
                entity.parent
            ));
        }
    };
    let name = field_name_node
        .ok_or_else(|| {
            format!(
                "Cannot locate field `{field_name}` on type `{}`.",
                entity.parent
            )
        })?
        .unwrap_or_else(|| {
            panic!(
                "Grats bug: Cannot find location of field `{field_name}` on type `{}`.",
                entity.parent
            )
        });
    Ok(name.loc.expect("Expected name to have loc"))
}

/// The name in the type's definition, if it has one.
fn type_name<'a>(r#type: &GraphQLNamedType<'a>) -> Option<&'a NameNode> {
    match r#type {
        GraphQLNamedType::Scalar(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Object(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Interface(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Union(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Enum(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::InputObject(t) => t.ast_node.map(|n| &n.name),
    }
}

/// Parses `ParentType` or `ParentType.fieldName`, where names are made of
/// ASCII letters, digits and underscores.
fn parse_entity_name(entity_name: &str) -> Result<EntityName<'_>, String> {
    let is_name =
        |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_');
    let (parent, field) = match entity_name.split_once('.') {
        Some((parent, field)) => (parent, Some(field)),
        None => (entity_name, None),
    };
    if !is_name(parent) || !field.is_none_or(is_name) {
        return Err(format!(
            "Invalid entity name: `{entity_name}`. Expected `ParentType` or `ParentType.fieldName`."
        ));
    }
    Ok(EntityName { parent, field })
}

#[cfg(test)]
mod tests {
    use super::parse_entity_name;

    #[test]
    fn parses_entity_names() {
        let parse = |name| parse_entity_name(name).map(|e| (e.parent, e.field));
        assert_eq!(parse("User"), Ok(("User", None)));
        assert_eq!(parse("User_1.id_2"), Ok(("User_1", Some("id_2"))));
        for invalid in ["", "User.", ".id", "User.id.name", "User id", "Üser"] {
            assert!(parse(invalid).is_err(), "{invalid:?}");
        }
    }
}
