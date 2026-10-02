//! Plain-data handles which the extractor records in an `ExtractionSnapshot`
//! in place of TypeScript AST nodes. They capture everything later passes need
//! to know about a node syntactically. Anything that requires knowing what a
//! name refers to is answered by `TypeContext`.
//!
//! The functions which record refs take oxc's nodes, along with the file
//! they're in.

use graphql_js::language::ast::Location;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    ExportDefaultDeclarationKind, Expression, IdentifierReference, TSType,
    TSTypeParameterDeclaration, TSTypeParameterInstantiation, TSTypeReference,
};
use oxc_span::{GetSpan, Span};

use crate::files::ParsedFile;
use crate::graphql_constructor::loc;
use crate::utils::diagnostic_error::TsLocatableNode;

/// Identifies a TypeScript declaration by the file and position at which it is
/// declared. Two `DeclLoc`s are equal if and only if they identify the same
/// declaration.
pub type DeclLoc = String;

/// A declaration which defines a GraphQL construct, or a TypeScript interface
/// used to define one.
#[derive(Debug)]
pub struct DeclRef {
    pub decl_loc: DeclLoc,
    pub name: Location,
    /// Used to materialize generic types.
    pub type_parameters: Vec<TypeParameterRef>,
}

#[derive(Debug, Clone)]
pub struct TypeParameterRef {
    pub decl_loc: DeclLoc,
    pub name: String,
    /// The whole type parameter declaration, including any constraint.
    pub loc: Location,
}

/// A reference to a TypeScript type by name, such as `Foo`, `ns.Foo` or
/// `Foo<Bar>`, which may reference a GraphQL type.
#[derive(Debug)]
pub struct EntityNameRef {
    /// The name being referenced, e.g. `ns.Foo` in `ns.Foo<Bar>`.
    pub name: Location,
    /// The whole reference, including any type arguments.
    pub loc: Location,
    pub type_arguments: Option<Vec<TypeArgumentRef>>,
}

#[derive(Debug)]
pub enum TypeArgumentRef {
    EntityName(EntityNameRef),
    OtherType { loc: Location },
}

/// Identifies the declaration in `file` whose name is at `anchor`, or for a
/// declaration without a name, the declaration at `anchor` (see `decl_ref`).
pub fn decl_loc(file: &ParsedFile, anchor: Span) -> DeclLoc {
    // Anchor on the name, if there is one, since its position is unaffected
    // by any modifiers or decorators.
    format!("{}:{}", file.path, file.offsets.to_utf16(anchor.start))
}

/// `node` is the declaration and `span` its whole span, including any
/// `export` and decorators.
pub fn decl_ref(file: &ParsedFile, node: AstKind, span: Span) -> DeclRef {
    let anchor = get_name_of_declaration(node).unwrap_or(span);
    DeclRef {
        decl_loc: decl_loc(file, anchor),
        name: loc(TsLocatableNode::new(file, anchor)),
        type_parameters: get_type_parameters(node)
            .into_iter()
            .flat_map(|parameters| &parameters.params)
            .map(|param| TypeParameterRef {
                decl_loc: decl_loc(file, param.name.span),
                name: param.name.name.to_string(),
                loc: loc(TsLocatableNode::new(file, param.span)),
            })
            .collect(),
    }
}

/// Like `ts.getNameOfDeclaration`, for the declarations Grats records.
fn get_name_of_declaration(node: AstKind) -> Option<Span> {
    match node {
        AstKind::Class(class) => class.id.as_ref().map(|id| id.span),
        AstKind::Function(function) => function.id.as_ref().map(|id| id.span),
        AstKind::TSInterfaceDeclaration(interface) => Some(interface.id.span),
        AstKind::TSTypeAliasDeclaration(alias) => Some(alias.id.span),
        AstKind::TSEnumDeclaration(declaration) => Some(declaration.id.span),
        AstKind::TSNamespaceDeclaration(namespace) => Some(namespace.id.span),
        AstKind::TSExternalModuleDeclaration(module) => Some(module.id.span),
        AstKind::TSGlobalDeclaration(global) => Some(global.global_span),
        AstKind::TSImportEqualsDeclaration(import) => Some(import.id.span),
        AstKind::TSNamespaceExportDeclaration(export) => Some(export.id.span),
        AstKind::TSExportAssignment(export) => match &export.expression {
            Expression::Identifier(id) => Some(id.span),
            _ => None,
        },
        AstKind::ExportDefaultDeclaration(export) => match &export.declaration {
            ExportDefaultDeclarationKind::Identifier(id) => Some(id.span),
            _ => None,
        },
        _ => None,
    }
}

fn get_type_parameters<'a>(declaration: AstKind<'a>) -> Option<&'a TSTypeParameterDeclaration<'a>> {
    match declaration {
        AstKind::TSTypeAliasDeclaration(declaration) => declaration.type_parameters.as_deref(),
        AstKind::TSInterfaceDeclaration(declaration) => declaration.type_parameters.as_deref(),
        AstKind::Class(declaration) => declaration.type_parameters.as_deref(),
        // TODO: Handle other types of declarations which have generics.
        _ => None,
    }
}

/// A TypeScript entity name, by the node it's the name of.
#[derive(Clone, Copy)]
pub enum EntityName<'n, 'a> {
    /// The name of a type reference.
    TypeReference(&'n TSTypeReference<'a>),
    /// The identifier of a heritage clause's type. Heritage clauses are not
    /// actually type references since they have runtime semantics. Instead
    /// they are an "ExpressionWithTypeArguments".
    ExpressionWithTypeArguments {
        expression: &'n IdentifierReference<'a>,
        type_arguments: Option<&'n TSTypeParameterInstantiation<'a>>,
    },
}

pub fn entity_name_ref(file: &ParsedFile, node: EntityName) -> EntityNameRef {
    match node {
        EntityName::TypeReference(node) => type_reference_ref(file, node),
        EntityName::ExpressionWithTypeArguments {
            expression,
            type_arguments,
        } => {
            // The reference spans from the name to the end of its last type
            // argument, excluding the closing `>`.
            let last = type_arguments
                .and_then(|type_arguments| type_arguments.params.last())
                .map_or(expression.span, |last| last.span());
            EntityNameRef {
                name: loc(TsLocatableNode::new(file, expression.span)),
                loc: loc(TsLocatableNode::new(
                    file,
                    Span::new(expression.span.start, last.end),
                )),
                type_arguments: type_argument_refs(file, type_arguments),
            }
        }
    }
}

fn type_reference_ref(file: &ParsedFile, node: &TSTypeReference) -> EntityNameRef {
    EntityNameRef {
        name: loc(TsLocatableNode::new(file, node.type_name.span())),
        loc: loc(TsLocatableNode::new(file, node.span)),
        type_arguments: type_argument_refs(file, node.type_arguments.as_deref()),
    }
}

fn type_argument_refs(
    file: &ParsedFile,
    type_arguments: Option<&TSTypeParameterInstantiation>,
) -> Option<Vec<TypeArgumentRef>> {
    let refs = type_arguments?.params.iter().map(|arg| match arg {
        TSType::TSTypeReference(arg) => TypeArgumentRef::EntityName(type_reference_ref(file, arg)),
        arg => TypeArgumentRef::OtherType {
            loc: loc(TsLocatableNode::new(file, arg.span())),
        },
    });
    Some(refs.collect())
}
