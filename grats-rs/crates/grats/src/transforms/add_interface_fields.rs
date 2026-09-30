//! Port of `src/transforms/addInterfaceFields.ts`.

use graphql_js::language::ast::{
    DefinitionNode, InterfaceTypeExtensionNode, NameNode, ObjectTypeExtensionNode,
};

use crate::errors as E;
use crate::extractor::FIELD_TAG;
use crate::interface_graph::{InterfaceImplementorKind, InterfaceMap, compute_interface_map};
use crate::type_context::{DeclarationDefinitionKind, TypeContext};
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticResult, DiagnosticsResult, gql_err, gql_related,
};
use crate::utils::helpers::{UNTRACKED_ID, null_throws};

/// Grats allows you to define GraphQL fields on TypeScript interfaces using
/// function syntax. This allows you to define a shared implementation for
/// all types that implement the interface.
///
/// This transform takes those abstract field definitions, and adds them to
/// the concrete types that implement the interface.
pub fn add_interface_fields(
    ctx: &TypeContext,
    docs: Vec<DefinitionNode>,
) -> DiagnosticsResult<Vec<DefinitionNode>> {
    let mut new_docs: Vec<DefinitionNode> = Vec::new();
    let mut errors: Vec<Diagnostic> = Vec::new();

    let interface_graph = compute_interface_map(ctx, &docs);

    for doc in docs {
        match doc {
            DefinitionNode::ObjectTypeExtension(doc) if doc.may_be_interface => {
                match add_abstract_field_definition(ctx, doc, &interface_graph) {
                    Err(error) => errors.push(error),
                    Ok(abstract_docs) => new_docs.extend(abstract_docs),
                }
            }
            doc => new_docs.push(doc),
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(new_docs)
}

// A field definition may be on a concrete type, or on an interface. If it's on an interface,
// we need to add it to each concrete type that implements the interface.
fn add_abstract_field_definition(
    ctx: &TypeContext,
    doc: ObjectTypeExtensionNode,
    interface_graph: &InterfaceMap,
) -> DiagnosticResult<Vec<DefinitionNode>> {
    let mut new_docs: Vec<DefinitionNode> = Vec::new();
    let name_definition = ctx.gql_name_definition_for_gql_name(&doc.name)?;

    let field = null_throws(doc.fields.and_then(|fields| fields.into_iter().next()));

    match name_definition.kind {
        DeclarationDefinitionKind::Type => {
            // Extending a type, is just adding a field to it.
            new_docs.push(DefinitionNode::ObjectTypeExtension(
                ObjectTypeExtensionNode {
                    name: doc.name,
                    fields: Some(vec![field]),
                    loc: doc.loc,
                    interfaces: None,
                    directives: None,
                    may_be_interface: false,
                },
            ));
        }
        DeclarationDefinitionKind::Interface => {
            // Extending an interface is a bit more complicated. We need to add the field
            // to the interface, and to each type that implements the interface.

            new_docs.push(DefinitionNode::InterfaceTypeExtension(
                InterfaceTypeExtensionNode {
                    name: doc.name,
                    fields: Some(vec![field.clone()]),
                    loc: None,
                    interfaces: None,
                    directives: None,
                },
            ));

            for implementor in interface_graph.get(&name_definition.name.value) {
                let name = NameNode {
                    value: implementor.name.clone(),
                    loc: doc.loc, // Bit of a lie, but I don't see a better option.
                    ts_identifier: UNTRACKED_ID,
                };
                match implementor.kind {
                    InterfaceImplementorKind::Type => {
                        new_docs.push(DefinitionNode::ObjectTypeExtension(
                            ObjectTypeExtensionNode {
                                name,
                                fields: Some(vec![field.clone()]),
                                loc: doc.loc,
                                interfaces: None,
                                directives: None,
                                may_be_interface: false,
                            },
                        ));
                    }
                    InterfaceImplementorKind::Interface => {
                        new_docs.push(DefinitionNode::InterfaceTypeExtension(
                            InterfaceTypeExtensionNode {
                                name,
                                fields: Some(vec![field.clone()]),
                                loc: doc.loc,
                                interfaces: None,
                                directives: None,
                            },
                        ));
                    }
                }
            }
        }
        _ => {
            // Extending any other type of definition is not supported.

            return Err(gql_err(
                doc.name.loc,
                E::invalid_type_passed_to_field_function(),
                Some(vec![gql_related(
                    name_definition.name.loc,
                    &format!("This is the type that was passed to `@{FIELD_TAG}`."),
                )]),
            ));
        }
    }
    Ok(new_docs)
}
