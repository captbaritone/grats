//! Port of `src/validations/validateAsyncIterable.ts`.

use graphql_js::language::ast::{DefinitionNode, DocumentNode, FieldDefinitionNode, TypeNode};

use crate::errors as E;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err};

/// Ensure that all fields on `Subscription` return an AsyncIterable and transform
/// the return type of subscription fields to not treat AsyncIterable as as list type.
///
/// PORT: TypeScript uses graphql-js's `visit` to replace fields. The Rust
/// visitor can't edit the AST, so this edits in place, walking to every node
/// that the TypeScript visitor has a function for.
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
            // Don't visit nodes that aren't the Subscription type.
            continue;
        }
        for field in fields.iter_mut().flatten() {
            visit_subscription_field(field, &mut errors);
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    Ok(doc)
}

fn visit_subscription_field(field: &mut FieldDefinitionNode, errors: &mut Vec<Diagnostic>) {
    let inner = inner_type(field.r#type.clone()); // Remove any non-null wrapper types

    let inner = match inner {
        TypeNode::ListType(inner) if inner.is_async_iterable => inner,
        _ => {
            errors.push(gql_err(
                field.r#type.loc(),
                E::subscription_field_not_async_iterable(),
                None,
            ));
            return;
        }
    };

    let item_type = *inner.r#type;

    // If either field.type or item type is nullable, the field should be nullable
    if is_nullable(&field.r#type) || is_nullable(&item_type) {
        let inner_inner = inner_type(item_type);
        field.r#type = inner_inner;
        return;
    }

    // If _both_ are non-nullable, we will preserve the non-nullability.
    field.r#type = item_type;
}

fn inner_type(r#type: TypeNode) -> TypeNode {
    if let TypeNode::NonNullType(t) = r#type {
        return inner_type((*t.r#type).into());
    }
    r#type
}

fn is_nullable(t: &TypeNode) -> bool {
    !matches!(t, TypeNode::NonNullType(_))
}
