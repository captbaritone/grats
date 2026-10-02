use graphql_js::language::ast::{
    DefinitionNode, FieldDefinitionNode, InterfaceTypeExtensionNode, Location, NameNode,
    ObjectTypeExtensionNode, UNTRACKED_ID,
};

use crate::errors as E;
use crate::extractor::FIELD_TAG;
use crate::interface_graph::{InterfaceImplementorKind, InterfaceMap, compute_interface_map};
use crate::type_context::{DeclarationDefinitionKind, TypeContext};
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticResult, DiagnosticsResult, gql_err, gql_related,
};
use crate::utils::result::ok_unless_errors;

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
    let mut new_docs = Vec::new();
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
    ok_unless_errors(errors, new_docs)
}

// A field definition may be on a concrete type, or on an interface. If it's on an interface,
// we need to add it to each concrete type that implements the interface.
fn add_abstract_field_definition(
    ctx: &TypeContext,
    doc: ObjectTypeExtensionNode,
    interface_graph: &InterfaceMap,
) -> DiagnosticResult<Vec<DefinitionNode>> {
    let name_definition = ctx.gql_name_definition_for_gql_name(&doc.name)?;
    let field = doc
        .fields
        .and_then(|fields| fields.into_iter().next())
        .expect("Field functions are extracted with their field");

    match name_definition.kind {
        // Extending a type, is just adding a field to it.
        DeclarationDefinitionKind::Type => Ok(vec![object_extension(doc.name, field, doc.loc)]),
        DeclarationDefinitionKind::Interface => {
            // Extending an interface is a bit more complicated. We need to add the field
            // to the interface, and to each type that implements the interface.
            let mut definitions = vec![interface_extension(doc.name, field.clone(), None)];
            definitions.extend(interface_graph.get(&name_definition.name.value).iter().map(
                |implementor| {
                    let name = NameNode {
                        value: implementor.name.clone(),
                        loc: doc.loc, // Bit of a lie, but I don't see a better option.
                        ts_identifier: UNTRACKED_ID,
                    };
                    match implementor.kind {
                        InterfaceImplementorKind::Type => {
                            object_extension(name, field.clone(), doc.loc)
                        }
                        InterfaceImplementorKind::Interface => {
                            interface_extension(name, field.clone(), doc.loc)
                        }
                    }
                },
            ));
            Ok(definitions)
        }
        // Extending any other type of definition is not supported.
        _ => Err(gql_err(
            doc.name.loc,
            E::invalid_type_passed_to_field_function(),
            Some(vec![gql_related(
                name_definition.name.loc,
                &format!("This is the type that was passed to `@{FIELD_TAG}`."),
            )]),
        )),
    }
}

fn object_extension(
    name: NameNode,
    field: FieldDefinitionNode,
    loc: Option<Location>,
) -> DefinitionNode {
    DefinitionNode::ObjectTypeExtension(ObjectTypeExtensionNode {
        name,
        fields: Some(vec![field]),
        loc,
        interfaces: None,
        directives: None,
        may_be_interface: false,
    })
}

fn interface_extension(
    name: NameNode,
    field: FieldDefinitionNode,
    loc: Option<Location>,
) -> DefinitionNode {
    DefinitionNode::InterfaceTypeExtension(InterfaceTypeExtensionNode {
        name,
        fields: Some(vec![field]),
        loc,
        interfaces: None,
        directives: None,
    })
}
