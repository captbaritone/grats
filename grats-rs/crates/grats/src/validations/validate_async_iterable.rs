use graphql_js::language::ast::{
    DefinitionNode, DocumentNode, FieldDefinitionNode, NullableTypeNode, TypeNode,
};

use crate::errors as E;
use crate::graphql_constructor::nullable_type;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err};
use crate::utils::result::ok_unless_errors;

/// Ensure that all fields on `Subscription` return an AsyncIterable and transform
/// the return type of subscription fields to not treat AsyncIterable as as list type.
pub fn validate_async_iterable(mut doc: DocumentNode) -> DiagnosticsResult<DocumentNode> {
    let mut errors: Vec<Diagnostic> = Vec::new();

    for definition in &mut doc.definitions {
        let (name, fields) = match definition {
            DefinitionNode::InterfaceTypeDefinition(t) => (&t.name, &mut t.fields),
            DefinitionNode::InterfaceTypeExtension(t) => (&t.name, &mut t.fields),
            DefinitionNode::ObjectTypeDefinition(t) => (&t.name, &mut t.fields),
            DefinitionNode::ObjectTypeExtension(t) => (&t.name, &mut t.fields),
            _ => continue,
        };
        // Note: We assume the default name is used here. When custom operation types are supported
        // we'll need to update this.
        if name.value != "Subscription" {
            continue;
        }
        for field in fields.iter_mut().flatten() {
            visit_subscription_field(field, &mut errors);
        }
    }
    ok_unless_errors(errors, doc)
}

fn visit_subscription_field(field: &mut FieldDefinitionNode, errors: &mut Vec<Diagnostic>) {
    // Remove any non-null wrapper type.
    let item_type = match nullable_type(field.r#type.clone()) {
        NullableTypeNode::ListType(list) if list.is_async_iterable => *list.r#type,
        _ => {
            errors.push(gql_err(
                field.r#type.loc(),
                E::subscription_field_not_async_iterable(),
                None,
            ));
            return;
        }
    };

    // If either field.type or item type is nullable, the field should be
    // nullable. If _both_ are non-nullable, we will preserve the non-nullability.
    field.r#type = if is_nullable(&field.r#type) || is_nullable(&item_type) {
        nullable_type(item_type).into()
    } else {
        item_type
    };
}

fn is_nullable(t: &TypeNode) -> bool {
    !matches!(t, TypeNode::NonNullType(_))
}
