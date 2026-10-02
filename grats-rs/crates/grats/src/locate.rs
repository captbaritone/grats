//! Port of `src/Locate.ts`.

use graphql_js::language::ast::{DocumentNode, Location, NameNode};
use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use serde::Deserialize;

use crate::utils::helpers::null_throws;

/// PORT: The input to `locate` from TypeScript, besides the document.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocateRequest {
    pub entity_name: String,
}

/// PORT: TypeScript passes the document rather than a schema, so this builds
/// the schema to locate the entity in.
pub fn locate_in_document(doc: &DocumentNode, request: LocateRequest) -> Result<Location, String> {
    let schema = build_ast_schema(doc);
    locate(&schema, &request.entity_name)
}

struct EntityName<'e> {
    parent: &'e str,
    field: Option<&'e str>,
}

/// Given an entity name of the format `ParentType` or `ParentType.fieldName`,
/// locate the entity in the schema and return its location.
pub fn locate(schema: &GraphQLSchema, entity_name: &str) -> Result<Location, String> {
    let entity = parse_entity_name(entity_name)?;
    let Some(r#type) = schema.get_type(entity.parent).map(|id| &schema[id]) else {
        return Err(format!("Cannot locate type `{}`.", entity.parent));
    };
    let Some(field_name) = entity.field else {
        let Some(name) = ast_node_name(r#type) else {
            panic!(
                "Grats bug: Cannot find location of type `{}`.",
                entity.parent
            );
        };
        return Ok(null_throws(name.loc));
    };

    // PORT: Looks up the field's AST node name, since the field types differ.
    let field = match r#type {
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
    let Some(field) = field else {
        return Err(format!(
            "Cannot locate field `{field_name}` on type `{}`.",
            entity.parent
        ));
    };

    let Some(name) = field else {
        panic!(
            "Grats bug: Cannot find location of field `{field_name}` on type `{}`.",
            entity.parent
        );
    };
    Ok(null_throws(name.loc))
}

/// PORT: `type.astNode.name` in the TypeScript implementation, where every
/// named type class has an `astNode` property.
fn ast_node_name<'a>(r#type: &GraphQLNamedType<'a>) -> Option<&'a NameNode> {
    match r#type {
        GraphQLNamedType::Scalar(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Object(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Interface(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Union(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::Enum(t) => t.ast_node.map(|n| &n.name),
        GraphQLNamedType::InputObject(t) => t.ast_node.map(|n| &n.name),
    }
}

/// PORT: Matches `ENTITY_NAME_REGEX`
/// (`/^([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?$/`) by hand.
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
