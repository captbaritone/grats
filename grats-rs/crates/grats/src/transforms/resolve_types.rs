//! Resolves the TypeScript type references in GraphQL definitions to the
//! GraphQL types they name, materializing generic types along the way.

use graphql_js::language::ast::{
    DefinitionNode, FieldDefinitionNode, InputValueDefinitionNode, Location, NameNode,
    NamedTypeNode, NullableTypeNode, TypeNode,
};
use rustc_hash::FxHashMap;

use crate::errors as E;
use crate::name_resolver::{ResolvedDeclaration, ResolvedDeclarationKind};
use crate::snapshot_refs::{DeclLoc, EntityNameRef, TypeArgumentRef, TypeParameterRef};
use crate::type_context::TypeContext;
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticResult, DiagnosticsResult, gql_err, gql_related,
};

const CHECKED: &str = "References are checked before types are materialized";

/// During extraction we are operating purely syntactically, so we don't
/// actually know which types are being referred to. This function resolves
/// those references.
///
/// It also materializes generic types. A definition whose type parameters are
/// used in GraphQL positions is a template, and each combination of type
/// arguments it's referenced with becomes a concrete type, named by prefixing
/// the template's name with the names of its type arguments. For example,
/// `Edge<User>` becomes `UserEdge`.
///
/// This happens in three phases:
///
/// 1. Find the templates, and which of their type parameters are used in
///    GraphQL positions.
/// 2. Check every reference, so each error is reported once, rather than once
///    for each type materialized from a template.
/// 3. Replace each reference with the name of the type it resolves to,
///    materializing templates as they're referenced.
///
/// A functional field may be generic too, as in
/// `function first<T>(page: Page<T>): T`. Grats represents it as an extension
/// of `Page<T>`, whose type arguments say what each of the function's type
/// parameters stands for: here, its `T` is whatever `Page` was given. So such
/// an extension isn't resolved on its own, but alongside each type
/// materialized from the template it extends, exactly like a method declared
/// on the template itself.
pub fn resolve_types(
    ctx: &TypeContext,
    mut definitions: Vec<DefinitionNode>,
) -> DiagnosticsResult<Vec<DefinitionNode>> {
    let references: Vec<Vec<&EntityNameRef>> = definitions
        .iter_mut()
        .map(|definition| {
            let mut references = Vec::new();
            for_each_type_name(definition, &mut |name| {
                references.extend(ctx.get_entity_name(name));
            });
            references
        })
        .collect();

    let generics = Generics::new(ctx, &definitions, &references);
    let generic_extensions: Vec<Option<GenericExtension>> = definitions
        .iter()
        .map(|definition| generic_extension(ctx, &generics, definition))
        .collect();

    let checker = Checker {
        ctx,
        generics: &generics,
    };
    let mut errors = Vec::new();
    for (((definition, references), candidate), extension) in definitions
        .iter()
        .zip(&references)
        .zip(&generics.definitions)
        .zip(&generic_extensions)
    {
        let bound: Vec<DeclLoc> = extension
            .iter()
            .flat_map(|extension| extension.bindings.iter().map(|(param, _)| param.clone()))
            .collect();
        checker.check_definition(definition, *candidate, references, &bound, &mut errors);
    }
    errors.extend(generics.infinite_expansions());
    if !errors.is_empty() {
        return Err(errors);
    }

    let mut templates = FxHashMap::default();
    let mut extensions: FxHashMap<usize, Vec<(DefinitionNode, GenericExtension)>> =
        FxHashMap::default();
    let mut concrete = Vec::new();
    for ((definition, candidate), extension) in definitions
        .into_iter()
        .zip(&generics.definitions)
        .zip(generic_extensions)
    {
        match (candidate, extension) {
            (Some(candidate), _) if generics.is_template(*candidate) => {
                templates.insert(*candidate, definition);
            }
            (_, Some(extension)) => extensions
                .entry(extension.template)
                .or_default()
                .push((definition, extension)),
            _ => concrete.push(definition),
        }
    }

    let mut materializer = Materializer {
        ctx,
        generics: &generics,
        templates: &templates,
        extensions: &extensions,
        instantiations: FxHashMap::default(),
        definitions: Vec::new(),
        errors: Vec::new(),
    };
    for mut definition in concrete {
        for_each_type_name(&mut definition, &mut |name| {
            if let Some(reference) = ctx.get_entity_name(name) {
                name.value = materializer.resolve(reference, &FxHashMap::default());
            }
        });
        materializer.definitions.push(definition);
    }
    if !materializer.errors.is_empty() {
        return Err(materializer.errors);
    }
    Ok(materializer.definitions)
}

/// An extension of a template which binds type parameters of its own, as a
/// generic functional field's does: `function first<T>(page: Page<T>): T`
/// extends `Page<T>`, binding the function's `T` to `Page`'s first type
/// argument.
struct GenericExtension {
    /// The template it extends.
    template: usize,
    /// Each type parameter it binds, and the index of the template's type
    /// parameter it's bound to.
    bindings: Vec<(DeclLoc, usize)>,
}

/// The extension's bindings, if it extends a template by passing type
/// parameters of its own as type arguments.
///
/// Only type arguments the template uses in a GraphQL position are bound,
/// since a template is materialized for those alone. A type parameter passed
/// to any other is left unbound, and reported where it's used, as before.
fn generic_extension(
    ctx: &TypeContext,
    generics: &Generics,
    definition: &DefinitionNode,
) -> Option<GenericExtension> {
    let name = match definition {
        DefinitionNode::ObjectTypeExtension(definition) => &definition.name,
        DefinitionNode::InterfaceTypeExtension(definition) => &definition.name,
        _ => return None,
    };
    let reference = ctx.get_entity_name(name)?;
    let declaration = ctx.resolve_entity_name(reference.name).ok()?;
    let template = generics.template(&declaration)?;
    let bindings: Vec<(DeclLoc, usize)> = reference
        .type_arguments
        .iter()
        .flatten()
        .enumerate()
        .filter(|(index, _)| generics.uses[template][*index].is_some())
        .filter_map(|(index, argument)| {
            let TypeArgumentRef::EntityName(argument) = argument else {
                return None;
            };
            let declaration = ctx.resolve_entity_name(argument.name).ok()?;
            (declaration.kind == ResolvedDeclarationKind::TypeParameter)
                .then_some((declaration.decl_loc, index))
        })
        .collect();
    (!bindings.is_empty()).then_some(GenericExtension { template, bindings })
}

/// The definitions which may be generic: those which may reference generics,
/// and whose TypeScript declarations have type parameters.
struct Generics {
    candidates: Vec<Candidate>,
    by_decl_loc: FxHashMap<DeclLoc, usize>,
    /// For each definition, the index of its candidate, if it is one.
    definitions: Vec<Option<usize>>,
    /// For each candidate, for each type parameter, the last reference to it in
    /// a GraphQL position, if there is one. Candidates with any are templates.
    uses: Vec<Vec<Option<Location>>>,
}

struct Candidate {
    /// The definition's name.
    name: String,
    type_parameters: Vec<TypeParameterRef>,
    /// The references to the candidate's type parameters within its
    /// definition, in the order they appear.
    occurrences: Vec<Occurrence>,
}

impl Candidate {
    fn param_index(&self, declaration: &ResolvedDeclaration) -> Option<usize> {
        if declaration.kind != ResolvedDeclarationKind::TypeParameter {
            return None;
        }
        self.type_parameters
            .iter()
            .position(|param| param.decl_loc == declaration.decl_loc)
    }
}

/// A type parameter: indexes of its candidate and of the type parameter.
type Param = (usize, usize);

/// A reference to one of a candidate's type parameters within its definition.
struct Occurrence {
    param: usize,
    /// The reference to the type parameter.
    loc: Location,
    /// The type parameters it's passed to as a type argument, from the
    /// outermost reference inwards, along with each reference it's passed to.
    /// For example, in `Connection<Edge<T>>`, `T` is passed to `Edge`'s type
    /// parameter, and `Edge<T>` to `Connection`'s.
    ///
    /// The reference is in a GraphQL position if each of those type
    /// parameters is used in one, since Grats ignores type arguments for type
    /// parameters which aren't.
    path: Vec<(Param, Location)>,
}

impl Occurrence {
    fn is_used(&self, uses: &[Vec<Option<Location>>]) -> bool {
        self.path
            .iter()
            .all(|((candidate, param), _)| uses[*candidate][*param].is_some())
    }
}

impl Generics {
    fn new(
        ctx: &TypeContext,
        definitions: &[DefinitionNode],
        references: &[Vec<&EntityNameRef>],
    ) -> Self {
        let mut generics = Generics {
            candidates: Vec::new(),
            by_decl_loc: FxHashMap::default(),
            definitions: Vec::new(),
            uses: Vec::new(),
        };
        for definition in definitions {
            let candidate = generic_definition_name(definition).and_then(|name| {
                let declaration = ctx.declaration_for_gql_definition(name);
                if declaration.type_parameters.is_empty() {
                    return None;
                }
                let index = generics.candidates.len();
                generics
                    .by_decl_loc
                    .insert(declaration.decl_loc.clone(), index);
                generics.candidates.push(Candidate {
                    name: name.value.clone(),
                    type_parameters: declaration.type_parameters.clone(),
                    occurrences: Vec::new(),
                });
                generics
                    .uses
                    .push(vec![None; declaration.type_parameters.len()]);
                Some(index)
            });
            generics.definitions.push(candidate);
        }

        for (references, candidate) in references.iter().zip(generics.definitions.clone()) {
            let Some(candidate) = candidate else {
                continue;
            };
            let mut occurrences = Vec::new();
            for reference in references {
                generics.find_occurrences(
                    ctx,
                    candidate,
                    reference,
                    &mut Vec::new(),
                    &mut occurrences,
                );
            }
            generics.candidates[candidate].occurrences = occurrences;
        }

        // A type parameter passed to another type parameter is used in a
        // GraphQL position if that type parameter is, so repeat until no more
        // are found.
        let mut found = true;
        while found {
            found = false;
            for (index, candidate) in generics.candidates.iter().enumerate() {
                for occurrence in &candidate.occurrences {
                    if generics.uses[index][occurrence.param].is_none()
                        && occurrence.is_used(&generics.uses)
                    {
                        generics.uses[index][occurrence.param] = Some(occurrence.loc);
                        found = true;
                    }
                }
            }
        }
        for (index, candidate) in generics.candidates.iter().enumerate() {
            for occurrence in &candidate.occurrences {
                if occurrence.is_used(&generics.uses) {
                    generics.uses[index][occurrence.param] = Some(occurrence.loc);
                }
            }
        }
        generics
    }

    /// Finds the references to `candidate`'s type parameters within
    /// `reference`, which is passed to the type parameters in `path`.
    fn find_occurrences(
        &self,
        ctx: &TypeContext,
        candidate: usize,
        reference: &EntityNameRef,
        path: &mut Vec<(Param, Location)>,
        occurrences: &mut Vec<Occurrence>,
    ) {
        let Ok(declaration) = ctx.resolve_entity_name(reference.name) else {
            return;
        };
        if let Some(param) = self.candidates[candidate].param_index(&declaration) {
            occurrences.push(Occurrence {
                param,
                loc: reference.name,
                path: path.clone(),
            });
            return;
        }
        // Type arguments are only passed on to candidates.
        let Some(&referenced) = self.by_decl_loc.get(&declaration.decl_loc) else {
            return;
        };
        let param_count = self.candidates[referenced].type_parameters.len();
        let type_arguments = reference.type_arguments.iter().flatten();
        for (index, argument) in type_arguments.enumerate().take(param_count) {
            if let TypeArgumentRef::EntityName(argument) = argument {
                path.push(((referenced, index), reference.loc));
                self.find_occurrences(ctx, candidate, argument, path, occurrences);
                path.pop();
            }
        }
    }

    fn is_template(&self, candidate: usize) -> bool {
        self.uses[candidate].iter().any(Option::is_some)
    }

    fn template(&self, declaration: &ResolvedDeclaration) -> Option<usize> {
        let candidate = *self.by_decl_loc.get(&declaration.decl_loc)?;
        self.is_template(candidate).then_some(candidate)
    }

    /// Templates are materialized by passing type arguments on to the type
    /// parameters they reference, so they expand infinitely if a type
    /// parameter is passed back to itself wrapped in another type, as in
    /// `children: Tree<Tree<T>>`.
    ///
    /// So, we look for cycles among the type parameters used in GraphQL
    /// positions, where each reference passing one type parameter to another
    /// is an edge, and report the references in them which pass a wrapped type
    /// parameter.
    fn infinite_expansions(&self) -> Vec<Diagnostic> {
        struct Edge {
            from: Param,
            to: Param,
            wraps: bool,
            reference: Location,
        }
        let mut edges = Vec::new();
        for (index, candidate) in self.candidates.iter().enumerate() {
            for occurrence in &candidate.occurrences {
                if !occurrence.is_used(&self.uses) {
                    continue;
                }
                let innermost = occurrence.path.len().saturating_sub(1);
                for (depth, &(to, reference)) in occurrence.path.iter().enumerate() {
                    edges.push(Edge {
                        from: (index, occurrence.param),
                        to,
                        wraps: depth < innermost,
                        reference,
                    });
                }
            }
        }

        let mut successors: FxHashMap<Param, Vec<Param>> = FxHashMap::default();
        for edge in &edges {
            successors.entry(edge.from).or_default().push(edge.to);
        }
        let reaches = |start: Param, target: Param| {
            let mut stack = vec![start];
            let mut visited = vec![start];
            while let Some(param) = stack.pop() {
                if param == target {
                    return true;
                }
                for &next in successors.get(&param).into_iter().flatten() {
                    if !visited.contains(&next) {
                        visited.push(next);
                        stack.push(next);
                    }
                }
            }
            false
        };

        let mut reported = Vec::new();
        for edge in &edges {
            if edge.wraps && !reported.contains(&edge.reference) && reaches(edge.to, edge.from) {
                reported.push(edge.reference);
            }
        }
        reported
            .into_iter()
            .map(|reference| gql_err(Some(reference), E::infinitely_nested_generic_type(), None))
            .collect()
    }
}

struct Checker<'a> {
    ctx: &'a TypeContext<'a>,
    generics: &'a Generics,
}

impl Checker<'_> {
    fn check_definition(
        &self,
        definition: &DefinitionNode,
        candidate: Option<usize>,
        references: &[&EntityNameRef],
        bound: &[DeclLoc],
        errors: &mut Vec<Diagnostic>,
    ) {
        for reference in references {
            if let Err(error) = self.check(reference, candidate, bound) {
                errors.push(error);
            }
        }
        if let Some(candidate) = candidate
            && self.generics.is_template(candidate)
            && let DefinitionNode::ObjectTypeDefinition(definition) = definition
            && let Some(interface) = definition.interfaces.iter().flatten().next()
        {
            errors.push(gql_err(
                interface.name.loc,
                E::generic_type_implements_interface(),
                None,
            ));
        }
    }

    /// Checks a reference within the definition of `candidate`, if it is one,
    /// where the type parameters in `bound` are bound by a generic extension.
    fn check(
        &self,
        reference: &EntityNameRef,
        candidate: Option<usize>,
        bound: &[DeclLoc],
    ) -> DiagnosticResult<()> {
        let declaration = self.ctx.resolve_entity_name(reference.name)?;
        if declaration.kind == ResolvedDeclarationKind::TypeParameter
            && bound.contains(&declaration.decl_loc)
        {
            return Ok(());
        }
        if let Some(candidate) = candidate
            && self.generics.candidates[candidate]
                .param_index(&declaration)
                .is_some()
        {
            return Ok(());
        }
        let Some(template) = self.generics.template(&declaration) else {
            return self.ctx.gql_name_for_ts_name(reference.name).map(drop);
        };
        let Candidate {
            name,
            type_parameters,
            ..
        } = &self.generics.candidates[template];
        for (index, param) in type_parameters.iter().enumerate() {
            let Some(example_use) = self.generics.uses[template][index] else {
                // Only type parameters used in GraphQL positions need GraphQL
                // types as type arguments.
                continue;
            };
            let related = || {
                vec![
                    gql_related(
                        Some(param.loc),
                        &format!("Type parameter `{}` is defined here", param.name),
                    ),
                    gql_related(
                        Some(example_use),
                        "and expects a GraphQL type because it was used in a GraphQL position here.",
                    ),
                ]
            };
            match reference.type_arguments.iter().flatten().nth(index) {
                None => {
                    return Err(gql_err(
                        Some(reference.loc),
                        E::missing_generic_type(name, &param.name),
                        Some(related()),
                    ));
                }
                Some(TypeArgumentRef::OtherType { loc }) => {
                    return Err(gql_err(
                        Some(*loc),
                        E::non_graphql_generic_type(name, &param.name),
                        Some(related()),
                    ));
                }
                Some(TypeArgumentRef::EntityName(argument)) => {
                    self.check(argument, candidate, bound)?
                }
            }
        }
        Ok(())
    }
}

/// A template with the names of the type arguments it was materialized with,
/// which are `None` for type parameters not used in a GraphQL position.
struct Instantiation {
    template: usize,
    type_arguments: Vec<Option<String>>,
    reference: Location,
}

struct Materializer<'a> {
    ctx: &'a TypeContext<'a>,
    generics: &'a Generics,
    templates: &'a FxHashMap<usize, DefinitionNode>,
    /// The generic extensions of each template, materialized with it.
    extensions: &'a FxHashMap<usize, Vec<(DefinitionNode, GenericExtension)>>,
    /// The instantiation each materialized type's name was derived for.
    instantiations: FxHashMap<String, Instantiation>,
    definitions: Vec<DefinitionNode>,
    errors: Vec<Diagnostic>,
}

impl Materializer<'_> {
    /// Resolves a reference to the name of the type it refers to, where
    /// `type_arguments` maps the type parameters in scope to the names of
    /// their type arguments.
    fn resolve(
        &mut self,
        reference: &EntityNameRef,
        type_arguments: &FxHashMap<DeclLoc, String>,
    ) -> String {
        let declaration = self.ctx.resolve_entity_name(reference.name).expect(CHECKED);
        if let Some(name) = type_arguments.get(&declaration.decl_loc) {
            return name.clone();
        }
        let Some(template) = self.generics.template(&declaration) else {
            return self
                .ctx
                .gql_name_for_ts_name(reference.name)
                .expect(CHECKED);
        };
        let uses = &self.generics.uses[template];
        let mut names = Vec::with_capacity(uses.len());
        for (index, example_use) in uses.iter().enumerate() {
            let name =
                example_use.map(
                    |_| match reference.type_arguments.iter().flatten().nth(index) {
                        Some(TypeArgumentRef::EntityName(argument)) => {
                            self.resolve(argument, type_arguments)
                        }
                        _ => panic!("{CHECKED}"),
                    },
                );
            names.push(name);
        }
        self.materialize(template, names, reference.loc)
    }

    fn materialize(
        &mut self,
        template: usize,
        type_arguments: Vec<Option<String>>,
        reference: Location,
    ) -> String {
        let candidate = &self.generics.candidates[template];
        // TODO: If we want to support templated names, e.g. `<T><K>Foo` we would
        // do that here.
        let derived_name: String = type_arguments
            .iter()
            .flatten()
            .map(String::as_str)
            .chain([candidate.name.as_str()])
            .collect();

        if let Some(existing) = self.instantiations.get(&derived_name) {
            // Different templates, or type arguments, may derive the same name.
            if existing.template != template || existing.type_arguments != type_arguments {
                let related = gql_related(
                    Some(existing.reference),
                    &format!("The other type named `{derived_name}` is referenced here."),
                );
                self.errors.push(gql_err(
                    Some(reference),
                    E::conflicting_generic_type_name(&derived_name),
                    Some(vec![related]),
                ));
            }
            // Otherwise, we've either already materialized this instantiation or
            // we're in the middle of doing so.
            return derived_name;
        }

        let scope: FxHashMap<DeclLoc, String> = candidate
            .type_parameters
            .iter()
            .zip(&type_arguments)
            .filter_map(|(param, name)| Some((param.decl_loc.clone(), name.clone()?)))
            .collect();
        self.instantiations.insert(
            derived_name.clone(),
            Instantiation {
                template,
                type_arguments,
                reference,
            },
        );

        let mut definition = self.templates[&template].clone();
        rename_definition(&mut definition, &derived_name, reference);
        let ctx = self.ctx;
        for_each_type_name(&mut definition, &mut |name| {
            if let Some(reference) = ctx.get_entity_name(name) {
                name.value = self.resolve(reference, &scope);
            }
        });
        self.definitions.push(definition);

        // Its generic extensions, with their own type parameters standing for
        // the type arguments they were bound to. Each one's name resolves to
        // this instantiation, which is already recorded, so it extends the
        // type just materialized.
        let type_arguments = &self.instantiations[&derived_name].type_arguments.clone();
        let extensions = self.extensions;
        for (extension, generic) in extensions.get(&template).into_iter().flatten() {
            let scope: FxHashMap<DeclLoc, String> = generic
                .bindings
                .iter()
                .filter_map(|(param, index)| Some((param.clone(), type_arguments[*index].clone()?)))
                .collect();
            let mut extension = extension.clone();
            for_each_type_name(&mut extension, &mut |name| {
                if let Some(reference) = ctx.get_entity_name(name) {
                    name.value = self.resolve(reference, &scope);
                }
            });
            self.definitions.push(extension);
        }
        derived_name
    }
}

/// The name of a definition which may reference generics.
fn generic_definition_name(definition: &DefinitionNode) -> Option<&NameNode> {
    match definition {
        DefinitionNode::ObjectTypeDefinition(definition) => Some(&definition.name),
        DefinitionNode::UnionTypeDefinition(definition) => Some(&definition.name),
        DefinitionNode::InterfaceTypeDefinition(definition) => Some(&definition.name),
        DefinitionNode::InputObjectTypeDefinition(definition) => Some(&definition.name),
        _ => None,
    }
}

fn rename_definition(definition: &mut DefinitionNode, new_name: &str, loc: Location) {
    let (definition_loc, name) = match definition {
        DefinitionNode::ObjectTypeDefinition(definition) => {
            definition.was_synthesized = true;
            (&mut definition.loc, &mut definition.name)
        }
        DefinitionNode::UnionTypeDefinition(definition) => {
            (&mut definition.loc, &mut definition.name)
        }
        DefinitionNode::InterfaceTypeDefinition(definition) => {
            (&mut definition.loc, &mut definition.name)
        }
        DefinitionNode::InputObjectTypeDefinition(definition) => {
            (&mut definition.loc, &mut definition.name)
        }
        _ => unreachable!("Only definitions which may reference generics are templates"),
    };
    *definition_loc = Some(loc);
    name.value = new_name.to_string();
    name.loc = Some(loc);
}

/// Calls `f` with each name in a definition which may be a type reference: the
/// names of the types it references, and its own name, which is a reference in
/// the extensions Grats creates for functional fields.
fn for_each_type_name(definition: &mut DefinitionNode, f: &mut dyn FnMut(&mut NameNode)) {
    fn named_types(nodes: &mut Option<Vec<NamedTypeNode>>, f: &mut dyn FnMut(&mut NameNode)) {
        for node in nodes.iter_mut().flatten() {
            f(&mut node.name);
        }
    }
    fn r#type(node: &mut TypeNode, f: &mut dyn FnMut(&mut NameNode)) {
        match node {
            TypeNode::NamedType(node) => f(&mut node.name),
            TypeNode::ListType(node) => r#type(&mut node.r#type, f),
            TypeNode::NonNullType(node) => match node.r#type.as_mut() {
                NullableTypeNode::NamedType(node) => f(&mut node.name),
                NullableTypeNode::ListType(node) => r#type(&mut node.r#type, f),
            },
        }
    }
    fn input_values(
        nodes: &mut Option<Vec<InputValueDefinitionNode>>,
        f: &mut dyn FnMut(&mut NameNode),
    ) {
        for node in nodes.iter_mut().flatten() {
            r#type(&mut node.r#type, f);
        }
    }
    fn fields(nodes: &mut Option<Vec<FieldDefinitionNode>>, f: &mut dyn FnMut(&mut NameNode)) {
        for node in nodes.iter_mut().flatten() {
            input_values(&mut node.arguments, f);
            r#type(&mut node.r#type, f);
        }
    }

    match definition {
        DefinitionNode::SchemaDefinition(node) => {
            for operation_type in &mut node.operation_types {
                f(&mut operation_type.r#type.name);
            }
        }
        DefinitionNode::SchemaExtension(node) => {
            for operation_type in node.operation_types.iter_mut().flatten() {
                f(&mut operation_type.r#type.name);
            }
        }
        DefinitionNode::ScalarTypeDefinition(node) => f(&mut node.name),
        DefinitionNode::ScalarTypeExtension(node) => f(&mut node.name),
        DefinitionNode::ObjectTypeDefinition(node) => {
            f(&mut node.name);
            named_types(&mut node.interfaces, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::ObjectTypeExtension(node) => {
            f(&mut node.name);
            named_types(&mut node.interfaces, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::InterfaceTypeDefinition(node) => {
            f(&mut node.name);
            named_types(&mut node.interfaces, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::InterfaceTypeExtension(node) => {
            f(&mut node.name);
            named_types(&mut node.interfaces, f);
            fields(&mut node.fields, f);
        }
        DefinitionNode::UnionTypeDefinition(node) => {
            f(&mut node.name);
            named_types(&mut node.types, f);
        }
        DefinitionNode::UnionTypeExtension(node) => {
            f(&mut node.name);
            named_types(&mut node.types, f);
        }
        DefinitionNode::EnumTypeDefinition(node) => f(&mut node.name),
        DefinitionNode::EnumTypeExtension(node) => f(&mut node.name),
        DefinitionNode::InputObjectTypeDefinition(node) => {
            f(&mut node.name);
            input_values(&mut node.fields, f);
        }
        DefinitionNode::InputObjectTypeExtension(node) => {
            f(&mut node.name);
            input_values(&mut node.fields, f);
        }
        DefinitionNode::DirectiveDefinition(node) => {
            f(&mut node.name);
            input_values(&mut node.arguments, f);
        }
    }
}
