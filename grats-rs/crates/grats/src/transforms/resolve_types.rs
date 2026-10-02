//! Port of `src/transforms/resolveTypes.ts`.

use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::hash_map::Entry;
use std::rc::Rc;

use graphql_js::language::ast::{
    ConstDirectiveNode, ConstValueNode, DefinitionNode, FieldDefinitionNode,
    InputValueDefinitionNode, Location, NameNode, NamedTypeNode, NullableTypeNode, TypeNode,
};
use indexmap::IndexMap;

use crate::errors as E;
use crate::name_resolver::ResolvedDeclarationKind;
use crate::snapshot_refs::{DeclLoc, EntityNameRef, TypeArgumentRef, TypeParameterRef};
use crate::type_context::TypeContext;
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticRelatedInformation, DiagnosticResult, DiagnosticsResult, gql_err,
    gql_related,
};
use crate::utils::helpers::null_throws;

struct Template {
    decl_loc: DeclLoc,
    /// PORT: A `TypeDefinitionNode`. Only definitions for which
    /// `mayReferenceGenerics` holds become templates.
    declaration_template: DefinitionNode,
    type_parameters: Vec<TypeParameterRef>,
    // References to the template's type parameters in GraphQL positions, keyed
    // by `locKey`.
    generic_nodes: IndexMap<LocKey, GenericReference>,
}

/// A generic type with the names of the type arguments it was materialized
/// with, which are `None` for type parameters not used in a GraphQL position.
struct Instantiation {
    template: DeclLoc,
    type_arguments: Vec<Option<String>>,
    reference: Location,
}

struct GenericReference {
    name: Location,
    // Index of the referenced type parameter
    index: usize,
}

/// During extraction we are operating purely syntactically, so we don't actually know
/// which types are being referred to. This function resolves those references.
///
/// It also materializes any generic type references into concrete types.
pub fn resolve_types(
    ctx: &TypeContext,
    definitions: Vec<DefinitionNode>,
) -> DiagnosticsResult<Vec<DefinitionNode>> {
    let mut template_extractor = TemplateExtractor::new(ctx);
    template_extractor.materialize_generic_type_references(definitions)
}

/// Template extraction happens in two phases and resolves named type references
/// as a side effect.
///
/// 1. We walk all declarations checking if they contain type references in
///    GraphQL positions which point back to the declaration's type parameters. If
///    so, they are considered templates and are removed from the list of "real"
///    declarations.
/// 2. We walk the remaining "real" declarations and resolve any type references,
///    if a reference refers to a template we first validate and resolve its type
///    arguments and then use those as inputs to materialize a new type to match
///    those type arguments.
///
/// ## Two Types of Recursion
///
/// 1. Type arguments may themselves be parameterized, and so we must
///    process generic type references recursively in a depth-first manner.
///
/// 2. When materializing templates we may encounter more parameterized
///    references to other templates. In this way, template materialization can be
///    recursive, and we must take care to avoid infinite loops. We must also take
///    care to correctly track our scope such that type references in templates
///    which refer to generic types resolve to the correct type.
struct TemplateExtractor<'a> {
    // PORT: Templates are shared, since materializing one may materialize others.
    templates: HashMap<DeclLoc, Rc<Template>>,
    definitions: Vec<DefinitionNode>,
    /// The instantiation each materialized type's name was derived for.
    instantiations: HashMap<String, Instantiation>,
    errors: Vec<Diagnostic>,
    ctx: &'a TypeContext<'a>,
}

impl<'a> TemplateExtractor<'a> {
    fn new(ctx: &'a TypeContext<'a>) -> Self {
        TemplateExtractor {
            templates: HashMap::new(),
            definitions: Vec::new(),
            instantiations: HashMap::new(),
            errors: Vec::new(),
            ctx,
        }
    }

    fn materialize_generic_type_references(
        &mut self,
        definitions: Vec<DefinitionNode>,
    ) -> DiagnosticsResult<Vec<DefinitionNode>> {
        // We filter out all template declarations and index them as a first pass.
        let filtered: Vec<DefinitionNode> = definitions
            .into_iter()
            .filter_map(|definition| self.maybe_extract_as_template(definition))
            .collect();

        // Now we can visit the remaining "real" definitions and materialize any
        // generic type references.
        for definition in filtered {
            let definition = self.materialize_templates_for_node(definition);
            self.definitions.push(definition);
        }

        if !self.errors.is_empty() {
            return Err(std::mem::take(&mut self.errors));
        }
        Ok(std::mem::take(&mut self.definitions))
    }

    /// Given a concrete (non-Generic) GraphQL type, walks GraphQL ASTs and expands
    /// generic types into their concrete types adding their materialized
    /// definitions to the `_definitions` array as we go.
    ///
    /// **Note:** Here we also detect generics being used as members of a union and
    /// report that as an error.
    ///
    /// PORT: TypeScript uses graphql-js's `visit` to replace names with resolved
    /// copies. The Rust visitor can't edit the AST, so this edits names in place.
    fn materialize_templates_for_node(&mut self, mut node: DefinitionNode) -> DefinitionNode {
        visit_names(&mut node, &mut |node, _| {
            let Some(reference_node) = self.get_reference_node(node) else {
                return;
            };
            let Some(name) = self.resolve_type_reference_or_report(reference_node, None) else {
                return;
            };
            node.value = name;
        });
        node
    }

    fn resolve_type_reference_or_report(
        &mut self,
        node: &EntityNameRef,
        generics: Option<&HashMap<DeclLoc, String>>,
    ) -> Option<String> {
        let declaration = self.as_nullable(self.ctx.resolve_entity_name(node.name))?;

        if let Some(generics) = generics {
            // Maybe this node references a generic!
            if let Some(generic_name) = generics.get(&declaration.decl_loc) {
                return Some(generic_name.clone());
            }
        }

        if let Some(template) = self.templates.get(&declaration.decl_loc).cloned() {
            let template_name = definition_name(&template.declaration_template)
                .value
                .clone();
            let type_arguments: &[TypeArgumentRef] = node.type_arguments.as_deref().unwrap_or(&[]);

            let mut generic_indexes: HashMap<usize, Location> = HashMap::new();
            for GenericReference { name, index } in template.generic_nodes.values() {
                generic_indexes.insert(*index, *name);
            }

            let mut names: Vec<Option<String>> = Vec::new();
            for i in 0..template.type_parameters.len() {
                let Some(example_generic_node) = generic_indexes.get(&i) else {
                    // This type param in the template is not used in a GraphQL position.
                    // We won't include it in the derived name.
                    names.push(None);
                    continue;
                };
                let param = &template.type_parameters[i];
                let param_name = &param.name;
                let related = || {
                    vec![
                        gql_related(
                            Some(param.loc),
                            &format!("Type parameter `{param_name}` is defined here"),
                        ),
                        gql_related(
                            Some(*example_generic_node),
                            "and expects a GraphQL type because it was used in a GraphQL position here.",
                        ),
                    ]
                };
                let Some(arg) = type_arguments.get(i) else {
                    return self.report(
                        node.loc,
                        E::missing_generic_type(&template_name, param_name),
                        Some(related()),
                    );
                };
                let arg = match arg {
                    TypeArgumentRef::EntityName(arg) => arg,
                    TypeArgumentRef::OtherType { loc } => {
                        return self.report(
                            *loc,
                            E::non_graphql_generic_type(&template_name, param_name),
                            Some(related()),
                        );
                    }
                };
                // resolveTypeReference will report an error if the definition is not found.
                let name = self.resolve_type_reference_or_report(arg, generics)?;
                names.push(Some(name));
            }

            return Some(self.materialize_template(node.loc, names, &template));
        }
        let name_result = self.ctx.gql_name_for_ts_name(node.name);

        self.as_nullable(name_result)
    }

    fn template_name(&self, type_params: &[Option<String>], template: &Template) -> String {
        let given_name = &definition_name(&template.declaration_template).value;

        // TODO: If we want to support templated names, e.g. `<T><K>Foo` we would do
        // that here.

        let params_prefix: String = type_params.iter().flatten().map(String::as_str).collect();
        params_prefix + given_name
    }

    fn materialize_template(
        &mut self,
        reference_loc: Location,
        type_params: Vec<Option<String>>,
        template: &Template,
    ) -> String {
        let derived_name = self.template_name(&type_params, template);
        match self.instantiations.entry(derived_name.clone()) {
            Entry::Occupied(entry) => {
                let existing = entry.get();
                // Different generic types, or type arguments, may derive the same name.
                if existing.template != template.decl_loc || existing.type_arguments != type_params
                {
                    let related = gql_related(
                        Some(existing.reference),
                        &format!("The other type named `{derived_name}` is referenced here."),
                    );
                    self.errors.push(gql_err(
                        Some(reference_loc),
                        E::conflicting_generic_type_name(&derived_name),
                        Some(vec![related]),
                    ));
                }
                // Otherwise, we've either already materialized this instantiation or
                // we're in the middle of doing so.
                return derived_name;
            }
            Entry::Vacant(entry) => {
                entry.insert(Instantiation {
                    template: template.decl_loc.clone(),
                    type_arguments: type_params.clone(),
                    reference: reference_loc,
                });
            }
        }

        // Mapping from the template's type param declaration to the GraphQL name
        // passed in for this particular use.
        let mut generics_context: HashMap<DeclLoc, String> = HashMap::new();
        let generic_indexes: Vec<usize> = template
            .generic_nodes
            .values()
            .map(|generic| generic.index)
            .collect();
        let mut seen = HashSet::new();
        for i in generic_indexes {
            // PORT: `new Set(genericIndexes)`.
            if !seen.insert(i) {
                continue;
            }
            let name = type_params
                .get(i)
                .expect("typeParams[i] should not be undefined");
            let Some(name) = name else {
                // If this type was not used in a GraphQL position, we won't have a
                // corresponding type argument.
                continue;
            };
            let param = null_throws(template.type_parameters.get(i));
            generics_context.insert(param.decl_loc.clone(), name.clone());
        }

        let original = &template.declaration_template;
        let mut definition = rename_definition(original.clone(), &derived_name, reference_loc);

        visit_names(&mut definition, &mut |node, in_named_type| {
            // PORT: The TypeScript visitor only visits `NamedType` nodes.
            if !in_named_type {
                return;
            }
            let Some(reference_node) = self.get_reference_node(node) else {
                return;
            };

            let Some(name) =
                self.resolve_type_reference_or_report(reference_node, Some(&generics_context))
            else {
                return;
            };

            node.value = name;
        });

        self.definitions.push(definition);
        derived_name
    }

    /// PORT: Returns the definition if it isn't extracted as a template, rather
    /// than whether it was.
    fn maybe_extract_as_template(
        &mut self,
        mut definition: DefinitionNode,
    ) -> Option<DefinitionNode> {
        if !may_reference_generics(&definition) {
            return Some(definition);
        }
        let ctx = self.ctx;
        let declaration = ctx.declaration_for_gql_definition(definition_name(&definition));
        let type_params = &declaration.type_parameters;

        if type_params.is_empty() {
            return Some(definition);
        }

        let mut generic_nodes: IndexMap<LocKey, GenericReference> = IndexMap::new();

        visit_names(&mut definition, &mut |node, in_named_type| {
            // PORT: The TypeScript visitor only visits `NamedType` nodes.
            if !in_named_type {
                return;
            }
            let Some(reference_node) = self.get_reference_node(node) else {
                return;
            };
            let references = find_all_references(reference_node);
            for reference in references {
                let declaration = match self.ctx.resolve_entity_name(reference.name) {
                    Err(error) => {
                        self.errors.push(error);
                        continue;
                    }
                    Ok(declaration) => declaration,
                };

                // If the type points to a type param...
                if declaration.kind != ResolvedDeclarationKind::TypeParameter {
                    continue;
                }
                // And it's one of our parent type's type params...
                let generic_index = type_params
                    .iter()
                    .position(|param| param.decl_loc == declaration.decl_loc);
                if let Some(generic_index) = generic_index {
                    generic_nodes.insert(
                        loc_key(reference.name),
                        GenericReference {
                            name: reference.name,
                            index: generic_index,
                        },
                    );
                }
            }
        });
        if generic_nodes.is_empty() {
            return Some(definition);
        }
        if let DefinitionNode::ObjectTypeDefinition(definition) = &definition
            && let Some(interfaces) = &definition.interfaces
            && let Some(first) = interfaces.first()
        {
            let item = &first.name;
            self.errors.push(gql_err(
                item.loc,
                E::generic_type_implements_interface(),
                None,
            ));
        }
        self.templates.insert(
            declaration.decl_loc.clone(),
            Rc::new(Template {
                decl_loc: declaration.decl_loc.clone(),
                declaration_template: definition,
                generic_nodes,
                type_parameters: type_params.clone(),
            }),
        );
        None
    }

    // --- Helpers ---

    /// Given a name within a non-Generic GraphQL definition, finds the corresponding
    /// TypeScript node representing the type reference.
    ///
    /// For example, in:
    ///
    /// ```ts
    /// // gqlType
    /// type User {
    ///   // gqlField
    ///   friend: Person
    /// }
    /// ```
    ///
    /// Given the `Person` NameNode, this will return the reference to the
    /// `Person` TypeScript type recorded during extraction.
    fn get_reference_node(&self, name: &NameNode) -> Option<&'a EntityNameRef> {
        self.ctx.get_entity_name(name)
    }

    fn as_nullable<T>(&mut self, result: DiagnosticResult<T>) -> Option<T> {
        match result {
            Err(error) => {
                self.errors.push(error);
                None
            }
            Ok(value) => Some(value),
        }
    }

    fn report(
        &mut self,
        loc: Location,
        message: String,
        related_information: Option<Vec<DiagnosticRelatedInformation>>,
    ) -> Option<String> {
        self.errors
            .push(gql_err(Some(loc), message, related_information));
        None
    }
}

fn may_reference_generics(definition: &DefinitionNode) -> bool {
    matches!(
        definition,
        DefinitionNode::ObjectTypeDefinition(_)
            | DefinitionNode::UnionTypeDefinition(_)
            | DefinitionNode::InterfaceTypeDefinition(_)
            | DefinitionNode::InputObjectTypeDefinition(_)
    )
}

/// PORT: `definition.name`, for the definitions `mayReferenceGenerics` holds for.
fn definition_name(definition: &DefinitionNode) -> &NameNode {
    match definition {
        DefinitionNode::ObjectTypeDefinition(definition) => &definition.name,
        DefinitionNode::UnionTypeDefinition(definition) => &definition.name,
        DefinitionNode::InterfaceTypeDefinition(definition) => &definition.name,
        DefinitionNode::InputObjectTypeDefinition(definition) => &definition.name,
        _ => panic!("Expected a definition which may reference generics."),
    }
}

/// PORT: `locKey` is a string of the source's name and the start offset.
/// Sources are encoded as indexes into the `SourceTable`, which gives each
/// file one index.
type LocKey = (u32, u32);

// Identifies a location by its file and start offset. Unlike `Location`
// objects, which may be created more than once for the same node, keys for the
// same node are equal.
fn loc_key(loc: Location) -> LocKey {
    (loc.source, loc.start)
}

// Given a type reference, recursively walk its type arguments and return all
// type references in the current scope.
fn find_all_references(node: &EntityNameRef) -> Vec<&EntityNameRef> {
    let mut references: Vec<&EntityNameRef> = Vec::new();
    if let Some(type_arguments) = &node.type_arguments {
        for arg in type_arguments {
            if let TypeArgumentRef::EntityName(arg) = arg {
                references.extend(find_all_references(arg));
            }
        }
    }
    references.push(node);
    references
}

/// PORT: TypeScript also sets `wasSynthesized` on union and interface
/// definitions, but nothing reads it there, so it's only modeled on object
/// types.
fn rename_definition(
    mut original: DefinitionNode,
    new_name: &str,
    loc: Location,
) -> DefinitionNode {
    fn rename(name: &mut NameNode, new_name: &str, loc: Location) {
        name.value = new_name.to_string();
        name.loc = Some(loc);
    }
    match &mut original {
        DefinitionNode::ObjectTypeDefinition(definition) => {
            definition.loc = Some(loc);
            rename(&mut definition.name, new_name, loc);
            definition.was_synthesized = true;
        }
        DefinitionNode::UnionTypeDefinition(definition) => {
            definition.loc = Some(loc);
            rename(&mut definition.name, new_name, loc);
        }
        DefinitionNode::InterfaceTypeDefinition(definition) => {
            definition.loc = Some(loc);
            rename(&mut definition.name, new_name, loc);
        }
        DefinitionNode::InputObjectTypeDefinition(definition) => {
            definition.loc = Some(loc);
            rename(&mut definition.name, new_name, loc);
        }
        _ => panic!("Expected a definition which may reference generics."),
    }
    original
}

/// PORT: graphql-js's `visit` with a visitor for `Name` nodes, which may edit
/// them. Calls `f` with each name in a definition, in the order `visit` would,
/// and whether the name is that of a `NamedType` node.
fn visit_names(definition: &mut DefinitionNode, f: &mut dyn FnMut(&mut NameNode, bool)) {
    fn named_type(node: &mut NamedTypeNode, f: &mut dyn FnMut(&mut NameNode, bool)) {
        f(&mut node.name, true);
    }
    fn named_types(nodes: &mut Option<Vec<NamedTypeNode>>, f: &mut dyn FnMut(&mut NameNode, bool)) {
        for node in nodes.iter_mut().flatten() {
            named_type(node, f);
        }
    }
    fn r#type(node: &mut TypeNode, f: &mut dyn FnMut(&mut NameNode, bool)) {
        match node {
            TypeNode::NamedType(node) => named_type(node, f),
            TypeNode::ListType(node) => r#type(&mut node.r#type, f),
            TypeNode::NonNullType(node) => match node.r#type.as_mut() {
                NullableTypeNode::NamedType(node) => named_type(node, f),
                NullableTypeNode::ListType(node) => r#type(&mut node.r#type, f),
            },
        }
    }
    fn value(node: &mut ConstValueNode, f: &mut dyn FnMut(&mut NameNode, bool)) {
        match node {
            ConstValueNode::ListValue(node) => {
                for node in &mut node.values {
                    value(node, f);
                }
            }
            ConstValueNode::ObjectValue(node) => {
                for field in &mut node.fields {
                    f(&mut field.name, false);
                    value(&mut field.value, f);
                }
            }
            _ => {}
        }
    }
    fn directives(
        nodes: &mut Option<Vec<ConstDirectiveNode>>,
        f: &mut dyn FnMut(&mut NameNode, bool),
    ) {
        for node in nodes.iter_mut().flatten() {
            f(&mut node.name, false);
            for argument in node.arguments.iter_mut().flatten() {
                f(&mut argument.name, false);
                value(&mut argument.value, f);
            }
        }
    }
    fn input_values(
        nodes: &mut Option<Vec<InputValueDefinitionNode>>,
        f: &mut dyn FnMut(&mut NameNode, bool),
    ) {
        for node in nodes.iter_mut().flatten() {
            f(&mut node.name, false);
            r#type(&mut node.r#type, f);
            if let Some(default_value) = &mut node.default_value {
                value(default_value, f);
            }
            directives(&mut node.directives, f);
        }
    }
    fn fields(
        nodes: &mut Option<Vec<FieldDefinitionNode>>,
        f: &mut dyn FnMut(&mut NameNode, bool),
    ) {
        for node in nodes.iter_mut().flatten() {
            f(&mut node.name, false);
            input_values(&mut node.arguments, f);
            r#type(&mut node.r#type, f);
            directives(&mut node.directives, f);
        }
    }

    match definition {
        DefinitionNode::SchemaDefinition(node) => {
            directives(&mut node.directives, f);
            for operation_type in &mut node.operation_types {
                named_type(&mut operation_type.r#type, f);
            }
        }
        DefinitionNode::SchemaExtension(node) => {
            directives(&mut node.directives, f);
            for operation_type in node.operation_types.iter_mut().flatten() {
                named_type(&mut operation_type.r#type, f);
            }
        }
        DefinitionNode::ScalarTypeDefinition(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
        }
        DefinitionNode::ScalarTypeExtension(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
        }
        DefinitionNode::ObjectTypeDefinition(node) => {
            f(&mut node.name, false);
            named_types(&mut node.interfaces, f);
            directives(&mut node.directives, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::ObjectTypeExtension(node) => {
            f(&mut node.name, false);
            named_types(&mut node.interfaces, f);
            directives(&mut node.directives, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::InterfaceTypeDefinition(node) => {
            f(&mut node.name, false);
            named_types(&mut node.interfaces, f);
            directives(&mut node.directives, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::InterfaceTypeExtension(node) => {
            f(&mut node.name, false);
            named_types(&mut node.interfaces, f);
            directives(&mut node.directives, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::UnionTypeDefinition(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
            named_types(&mut node.types, f);
        }
        DefinitionNode::UnionTypeExtension(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
            named_types(&mut node.types, f);
        }
        DefinitionNode::EnumTypeDefinition(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
            for value in node.values.iter_mut().flatten() {
                f(&mut value.name, false);
                directives(&mut value.directives, f);
            }
        }
        DefinitionNode::EnumTypeExtension(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
            for value in node.values.iter_mut().flatten() {
                f(&mut value.name, false);
                directives(&mut value.directives, f);
            }
        }
        DefinitionNode::InputObjectTypeDefinition(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
            input_values(&mut node.fields, f);
        }
        DefinitionNode::InputObjectTypeExtension(node) => {
            f(&mut node.name, false);
            directives(&mut node.directives, f);
            input_values(&mut node.fields, f);
        }
        DefinitionNode::DirectiveDefinition(node) => {
            f(&mut node.name, false);
            input_values(&mut node.arguments, f);
            for location in &mut node.locations {
                f(location, false);
            }
        }
    }
}
