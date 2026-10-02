//! Port of graphql-js `type/validate.ts`.
//!
//! PORT: Only `validateSchema` is ported.

use std::iter::once;

use indexmap::IndexMap;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::{
    ConstDirectiveNode, InputValueDefinitionNode, NamedTypeNode, OperationTypeNode,
};
use crate::language::visitor::ASTNode;
use crate::r#type::definition::{
    GraphQLEnumType, GraphQLField, GraphQLInputField, GraphQLInputObjectType, GraphQLInterfaceType,
    GraphQLNamedType, GraphQLObjectType, GraphQLScalarType, GraphQLType, GraphQLUnionType, TypeId,
    is_required_argument, is_required_input_field,
};
use crate::r#type::directives::GRAPHQL_DEPRECATED_DIRECTIVE;
use crate::r#type::introspection::is_introspection_type;
use crate::r#type::schema::GraphQLSchema;
use crate::utilities::type_comparators::{is_equal_type, is_type_sub_type_of};

/// Implements the "Type Validation" sub-sections of the specification's
/// "Type System" section.
///
/// Validation runs synchronously, returning an array of encountered errors, or
/// an empty array if no errors were encountered and the Schema is valid.
///
/// PORT: graphql-js first asserts that it was passed a schema, and caches the
/// errors on the schema. Here the types ensure the former, and each schema is
/// only validated once.
pub fn validate_schema(schema: &GraphQLSchema) -> Vec<GraphQLError> {
    // Validate the schema, producing a list of errors.
    let mut context = SchemaValidationContext::new(schema);
    validate_root_types(&mut context);
    validate_directives(&mut context);
    validate_types(&mut context);

    context.get_errors()
}

struct SchemaValidationContext<'s, 'a> {
    errors: Vec<GraphQLError>,
    schema: &'s GraphQLSchema<'a>,
}

impl<'s, 'a> SchemaValidationContext<'s, 'a> {
    fn new(schema: &'s GraphQLSchema<'a>) -> Self {
        SchemaValidationContext {
            errors: Vec::new(),
            schema,
        }
    }

    /// PORT: graphql-js takes a node or an array of nodes, and drops missing
    /// nodes from arrays. Here it always takes a list, and drops missing nodes.
    fn report_error<'n>(
        &mut self,
        message: String,
        nodes: impl IntoIterator<Item = Option<ASTNode<'n>>>,
    ) {
        let nodes = nodes.into_iter().flatten().map(|node| node.loc()).collect();
        self.errors.push(GraphQLError::new(message, nodes));
    }

    fn get_errors(self) -> Vec<GraphQLError> {
        self.errors
    }
}

fn validate_root_types(context: &mut SchemaValidationContext) {
    let schema = context.schema;
    let query_type = schema.get_query_type();

    match query_type {
        None => {
            context.report_error(
                "Query root type must be provided.".to_string(),
                [schema.ast_node.map(ASTNode::SchemaDefinition)],
            );
        }
        Some(query_type) if !matches!(schema[query_type], GraphQLNamedType::Object(_)) => {
            context.report_error(
                format!(
                    "Query root type must be Object type, it cannot be {}.",
                    schema[query_type].name()
                ),
                [get_operation_type_node(schema, OperationTypeNode::Query)
                    .map(ASTNode::NamedType)
                    .or_else(|| schema[query_type].get_ast_node())],
            );
        }
        Some(_) => {}
    }

    let mutation_type = schema.get_mutation_type();

    if let Some(mutation_type) = mutation_type
        && !matches!(schema[mutation_type], GraphQLNamedType::Object(_))
    {
        context.report_error(
            format!(
                "Mutation root type must be Object type if provided, it cannot be {}.",
                schema[mutation_type].name()
            ),
            [get_operation_type_node(schema, OperationTypeNode::Mutation)
                .map(ASTNode::NamedType)
                .or_else(|| schema[mutation_type].get_ast_node())],
        );
    }

    let subscription_type = schema.get_subscription_type();

    if let Some(subscription_type) = subscription_type
        && !matches!(schema[subscription_type], GraphQLNamedType::Object(_))
    {
        context.report_error(
            format!(
                "Subscription root type must be Object type if provided, it cannot be {}.",
                schema[subscription_type].name()
            ),
            [
                get_operation_type_node(schema, OperationTypeNode::Subscription)
                    .map(ASTNode::NamedType)
                    .or_else(|| schema[subscription_type].get_ast_node()),
            ],
        );
    }
}

fn get_operation_type_node<'a>(
    schema: &GraphQLSchema<'a>,
    operation: OperationTypeNode,
) -> Option<&'a NamedTypeNode> {
    let schema_nodes_operation_types = schema
        .ast_node
        .map(|schema_node| schema_node.operation_types.as_slice())
        .into_iter()
        .chain(
            schema
                .extension_ast_nodes
                .iter()
                // FIXME: https://github.com/graphql/graphql-js/issues/2203
                .map(|schema_node| schema_node.operation_types.as_deref().unwrap_or_default()),
        );
    schema_nodes_operation_types
        .flatten()
        .find(|operation_node| operation_node.operation == operation)
        .map(|operation_node| &operation_node.r#type)
}

fn validate_directives(context: &mut SchemaValidationContext) {
    let schema = context.schema;
    for directive in schema.get_directives() {
        // PORT: graphql-js first ensures all directives are in fact GraphQL
        // directives, which the types here guarantee.
        let directive_ast_node = directive.ast_node.map(ASTNode::DirectiveDefinition);

        // Ensure they are named correctly.
        validate_name(context, directive.name, directive_ast_node);

        if directive.locations.is_empty() {
            context.report_error(
                format!(
                    "Directive @{} must include 1 or more locations.",
                    directive.name
                ),
                [directive_ast_node],
            );
        }

        // Ensure the arguments are valid.
        for arg in &directive.args {
            // Ensure they are named correctly.
            validate_name(
                context,
                arg.name,
                arg.ast_node.map(ASTNode::InputValueDefinition),
            );

            // Ensure the type is an input type.
            if !arg.r#type.is_input_type(schema.arena()) {
                context.report_error(
                    format!(
                        "The type of @{}({}:) must be Input Type but got: {}.",
                        directive.name,
                        arg.name,
                        arg.r#type.inspect(schema.arena())
                    ),
                    [arg.ast_node.map(ASTNode::InputValueDefinition)],
                );
            }

            if is_required_argument(arg) && arg.deprecation_reason.is_some() {
                context.report_error(
                    format!(
                        "Required argument @{}({}:) cannot be deprecated.",
                        directive.name, arg.name
                    ),
                    [
                        get_deprecated_directive_node(arg.ast_node).map(ASTNode::Directive),
                        arg.ast_node.map(|node| ASTNode::from(&node.r#type)),
                    ],
                );
            }
        }
    }
}

/// PORT: graphql-js takes the node which has the name and AST node.
fn validate_name(context: &mut SchemaValidationContext, name: &str, ast_node: Option<ASTNode>) {
    // Ensure names are valid, however introspection types opt out.
    if name.starts_with("__") {
        context.report_error(
            format!(
                "Name \"{name}\" must not begin with \"__\", which is reserved by GraphQL introspection."
            ),
            [ast_node],
        );
    }
}

fn validate_types(context: &mut SchemaValidationContext) {
    let schema = context.schema;
    let mut validate_input_object_circular_refs = InputObjectCircularRefsValidator::new();
    let type_map = schema.get_type_map();

    for &type_id in type_map.values() {
        let r#type = &schema[type_id];
        // PORT: graphql-js first ensures all provided types are in fact
        // GraphQL types, which the types here guarantee.

        // Ensure it is named correctly (excluding introspection types).
        if !is_introspection_type(type_id) {
            validate_name(context, r#type.name(), r#type.get_ast_node());
        }

        match r#type {
            GraphQLNamedType::Object(_) => {
                // Ensure fields are valid
                validate_fields(context, type_id);

                // Ensure objects implement the interfaces they claim to.
                validate_interfaces(context, type_id);
            }
            GraphQLNamedType::Interface(_) => {
                // Ensure fields are valid.
                validate_fields(context, type_id);

                // Ensure interfaces implement the interfaces they claim to.
                validate_interfaces(context, type_id);
            }
            GraphQLNamedType::Union(union_type) => {
                // Ensure Unions include valid member types.
                validate_union_members(context, union_type);
            }
            GraphQLNamedType::Enum(enum_type) => {
                // Ensure Enums have valid values.
                validate_enum_values(context, enum_type);
            }
            GraphQLNamedType::InputObject(input_object_type) => {
                // Ensure Input Object fields are valid.
                validate_input_fields(context, input_object_type);

                // Ensure Input Objects do not contain non-nullable circular references
                validate_input_object_circular_refs
                    .detect_cycle_recursive(context, input_object_type);
            }
            GraphQLNamedType::Scalar(_) => {}
        }
    }
}

/// PORT: Takes the id of an object or interface type.
fn validate_fields(context: &mut SchemaValidationContext, type_id: TypeId) {
    let schema = context.schema;
    let r#type = &schema[type_id];
    let type_name = r#type.name();
    let fields = get_fields(r#type);

    // Objects and Interfaces both must define one or more fields.
    if fields.is_empty() {
        context.report_error(
            format!("Type {type_name} must define one or more fields."),
            r#type.get_all_ast_nodes(),
        );
    }

    for field in fields.values() {
        let field_name = field.name;

        // Ensure they are named correctly.
        validate_name(
            context,
            field_name,
            field.ast_node.map(ASTNode::FieldDefinition),
        );

        // Ensure the type is an output type
        if !field.r#type.is_output_type(schema.arena()) {
            context.report_error(
                format!(
                    "The type of {type_name}.{field_name} must be Output Type but got: {}.",
                    field.r#type.inspect(schema.arena())
                ),
                [field.ast_node.map(|node| ASTNode::from(&node.r#type))],
            );
        }

        // Ensure the arguments are valid
        for arg in &field.args {
            let arg_name = arg.name;

            // Ensure they are named correctly.
            validate_name(
                context,
                arg_name,
                arg.ast_node.map(ASTNode::InputValueDefinition),
            );

            // Ensure the type is an input type
            if !arg.r#type.is_input_type(schema.arena()) {
                context.report_error(
                    format!(
                        "The type of {type_name}.{field_name}({arg_name}:) must be Input Type but got: {}.",
                        arg.r#type.inspect(schema.arena())
                    ),
                    [arg.ast_node.map(|node| ASTNode::from(&node.r#type))],
                );
            }

            if is_required_argument(arg) && arg.deprecation_reason.is_some() {
                context.report_error(
                    format!(
                        "Required argument {type_name}.{field_name}({arg_name}:) cannot be deprecated."
                    ),
                    [
                        get_deprecated_directive_node(arg.ast_node).map(ASTNode::Directive),
                        arg.ast_node.map(|node| ASTNode::from(&node.r#type)),
                    ],
                );
            }
        }
    }
}

/// PORT: Takes the id of an object or interface type.
fn validate_interfaces(context: &mut SchemaValidationContext, type_id: TypeId) {
    let schema = context.schema;
    let r#type = &schema[type_id];
    let mut iface_type_names = FxHashSet::default();

    for &iface_id in get_interfaces(r#type) {
        let iface = &schema[iface_id];
        if !matches!(iface, GraphQLNamedType::Interface(_)) {
            context.report_error(
                format!(
                    "Type {} must only implement Interface types, it cannot implement {}.",
                    r#type.name(),
                    iface.name()
                ),
                get_all_implements_interface_nodes(r#type, iface.name()),
            );
            continue;
        }

        if type_id == iface_id {
            context.report_error(
                format!(
                    "Type {} cannot implement itself because it would create a circular reference.",
                    r#type.name()
                ),
                get_all_implements_interface_nodes(r#type, iface.name()),
            );
            continue;
        }

        if iface_type_names.contains(iface.name()) {
            context.report_error(
                format!(
                    "Type {} can only implement {} once.",
                    r#type.name(),
                    iface.name()
                ),
                get_all_implements_interface_nodes(r#type, iface.name()),
            );
            continue;
        }

        iface_type_names.insert(iface.name());

        validate_type_implements_ancestors(context, type_id, iface_id);
        validate_type_implements_interface(context, type_id, iface_id);
    }
}

/// PORT: Takes the ids of an object or interface type, and an interface type.
fn validate_type_implements_interface(
    context: &mut SchemaValidationContext,
    type_id: TypeId,
    iface_id: TypeId,
) {
    let schema = context.schema;
    let r#type = &schema[type_id];
    let GraphQLNamedType::Interface(iface) = &schema[iface_id] else {
        unreachable!("Expected an interface type.");
    };
    let type_field_map = get_fields(r#type);

    // Assert each interface field is implemented.
    for iface_field in iface.get_fields().values() {
        let field_name = iface_field.name;
        let type_field = type_field_map.get(field_name);

        // Assert interface field exists on type.
        let Some(type_field) = type_field else {
            context.report_error(
                format!(
                    "Interface field {}.{field_name} expected but {} does not provide it.",
                    iface.name,
                    r#type.name()
                ),
                once(iface_field.ast_node.map(ASTNode::FieldDefinition))
                    .chain(r#type.get_all_ast_nodes()),
            );
            continue;
        };

        // Assert interface field type is satisfied by type field type, by being
        // a valid subtype. (covariant)
        if !is_type_sub_type_of(schema, &type_field.r#type, &iface_field.r#type) {
            context.report_error(
                format!(
                    "Interface field {}.{field_name} expects type {} but {}.{field_name} is type {}.",
                    iface.name,
                    iface_field.r#type.inspect(schema.arena()),
                    r#type.name(),
                    type_field.r#type.inspect(schema.arena())
                ),
                [
                    iface_field.ast_node.map(|node| ASTNode::from(&node.r#type)),
                    type_field.ast_node.map(|node| ASTNode::from(&node.r#type)),
                ],
            );
        }

        // Assert each interface field arg is implemented.
        for iface_arg in &iface_field.args {
            let arg_name = iface_arg.name;
            let type_arg = type_field.args.iter().find(|arg| arg.name == arg_name);

            // Assert interface field arg exists on object field.
            let Some(type_arg) = type_arg else {
                context.report_error(
                    format!(
                        "Interface field argument {}.{field_name}({arg_name}:) expected but {}.{field_name} does not provide it.",
                        iface.name,
                        r#type.name()
                    ),
                    [
                        iface_arg.ast_node.map(ASTNode::InputValueDefinition),
                        type_field.ast_node.map(ASTNode::FieldDefinition),
                    ],
                );
                continue;
            };

            // Assert interface field arg type matches object field arg type.
            // (invariant)
            // TODO: change to contravariant?
            if !is_equal_type(&iface_arg.r#type, &type_arg.r#type) {
                context.report_error(
                    format!(
                        "Interface field argument {}.{field_name}({arg_name}:) expects type {} but {}.{field_name}({arg_name}:) is type {}.",
                        iface.name,
                        iface_arg.r#type.inspect(schema.arena()),
                        r#type.name(),
                        type_arg.r#type.inspect(schema.arena())
                    ),
                    [
                        iface_arg.ast_node.map(|node| ASTNode::from(&node.r#type)),
                        type_arg.ast_node.map(|node| ASTNode::from(&node.r#type)),
                    ],
                );
            }

            // TODO: validate default values?
        }

        // Assert additional arguments must not be required.
        for type_arg in &type_field.args {
            let arg_name = type_arg.name;
            let iface_arg = iface_field.args.iter().find(|arg| arg.name == arg_name);
            if iface_arg.is_none() && is_required_argument(type_arg) {
                context.report_error(
                    format!(
                        "Object field {}.{field_name} includes required argument {arg_name} that is missing from the Interface field {}.{field_name}.",
                        r#type.name(),
                        iface.name
                    ),
                    [
                        type_arg.ast_node.map(ASTNode::InputValueDefinition),
                        iface_field.ast_node.map(ASTNode::FieldDefinition),
                    ],
                );
            }
        }
    }
}

/// PORT: Takes the ids of an object or interface type, and an interface type.
fn validate_type_implements_ancestors(
    context: &mut SchemaValidationContext,
    type_id: TypeId,
    iface_id: TypeId,
) {
    let schema = context.schema;
    let r#type = &schema[type_id];
    let iface = &schema[iface_id];
    let iface_interfaces = get_interfaces(r#type);
    for &transitive in get_interfaces(iface) {
        if !iface_interfaces.contains(&transitive) {
            let message = if transitive == type_id {
                format!(
                    "Type {} cannot implement {} because it would create a circular reference.",
                    r#type.name(),
                    iface.name()
                )
            } else {
                format!(
                    "Type {} must implement {} because it is implemented by {}.",
                    r#type.name(),
                    schema[transitive].name(),
                    iface.name()
                )
            };
            context.report_error(
                message,
                get_all_implements_interface_nodes(iface, schema[transitive].name())
                    .into_iter()
                    .chain(get_all_implements_interface_nodes(r#type, iface.name())),
            );
        }
    }
}

fn validate_union_members(context: &mut SchemaValidationContext, union: &GraphQLUnionType) {
    let schema = context.schema;
    let member_types = union.get_types();

    if member_types.is_empty() {
        context.report_error(
            format!(
                "Union type {} must define one or more member types.",
                union.name
            ),
            union.get_all_ast_nodes(),
        );
    }

    let mut included_type_names = FxHashSet::default();
    for &member_type in member_types {
        let member_type = &schema[member_type];
        if included_type_names.contains(member_type.name()) {
            context.report_error(
                format!(
                    "Union type {} can only include type {} once.",
                    union.name,
                    member_type.name()
                ),
                get_union_member_type_nodes(union, member_type.name()),
            );
            continue;
        }
        included_type_names.insert(member_type.name());
        if !matches!(member_type, GraphQLNamedType::Object(_)) {
            context.report_error(
                format!(
                    "Union type {} can only include Object types, it cannot include {}.",
                    union.name,
                    member_type.name()
                ),
                get_union_member_type_nodes(union, member_type.name()),
            );
        }
    }
}

fn validate_enum_values(context: &mut SchemaValidationContext, enum_type: &GraphQLEnumType) {
    let enum_values = enum_type.get_values();

    if enum_values.is_empty() {
        context.report_error(
            format!(
                "Enum type {} must define one or more values.",
                enum_type.name
            ),
            enum_type.get_all_ast_nodes(),
        );
    }

    for enum_value in enum_values {
        // Ensure valid name.
        validate_name(
            context,
            enum_value.name,
            enum_value.ast_node.map(ASTNode::EnumValueDefinition),
        );
    }
}

fn validate_input_fields(
    context: &mut SchemaValidationContext,
    input_obj: &GraphQLInputObjectType,
) {
    let schema = context.schema;
    let fields = input_obj.get_fields();

    if fields.is_empty() {
        context.report_error(
            format!(
                "Input Object type {} must define one or more fields.",
                input_obj.name
            ),
            input_obj.get_all_ast_nodes(),
        );
    }

    // Ensure the arguments are valid
    for field in fields.values() {
        // Ensure they are named correctly.
        validate_name(
            context,
            field.name,
            field.ast_node.map(ASTNode::InputValueDefinition),
        );

        // Ensure the type is an input type
        if !field.r#type.is_input_type(schema.arena()) {
            context.report_error(
                format!(
                    "The type of {}.{} must be Input Type but got: {}.",
                    input_obj.name,
                    field.name,
                    field.r#type.inspect(schema.arena())
                ),
                [field.ast_node.map(|node| ASTNode::from(&node.r#type))],
            );
        }

        if is_required_input_field(field) && field.deprecation_reason.is_some() {
            context.report_error(
                format!(
                    "Required input field {}.{} cannot be deprecated.",
                    input_obj.name, field.name
                ),
                [
                    get_deprecated_directive_node(field.ast_node).map(ASTNode::Directive),
                    field.ast_node.map(|node| ASTNode::from(&node.r#type)),
                ],
            );
        }

        if input_obj.is_one_of {
            validate_one_of_input_object_field(input_obj, field, context);
        }
    }
}

fn validate_one_of_input_object_field(
    r#type: &GraphQLInputObjectType,
    field: &GraphQLInputField,
    context: &mut SchemaValidationContext,
) {
    if field.r#type.is_non_null_type() {
        context.report_error(
            format!(
                "OneOf input field {}.{} must be nullable.",
                r#type.name, field.name
            ),
            [field.ast_node.map(|node| ASTNode::from(&node.r#type))],
        );
    }

    if field.default_value.is_some() {
        context.report_error(
            format!(
                "OneOf input field {}.{} cannot have a default value.",
                r#type.name, field.name
            ),
            [field.ast_node.map(ASTNode::InputValueDefinition)],
        );
    }
}

/// Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
///
/// PORT: graphql-js returns a function closing over this state and the
/// context. Here the context is passed to `detect_cycle_recursive`, since the
/// other validations report errors to it too.
struct InputObjectCircularRefsValidator<'s, 'a> {
    // Tracks already visited types to maintain O(N) and to ensure that cycles
    // are not redundantly reported.
    visited_types: FxHashSet<&'a str>,

    // Array of types nodes used to produce meaningful errors
    field_path: Vec<&'s GraphQLInputField<'a>>,

    // Position in the type path
    field_path_index_by_type_name: FxHashMap<&'a str, usize>,
}

impl<'s, 'a> InputObjectCircularRefsValidator<'s, 'a> {
    fn new() -> Self {
        InputObjectCircularRefsValidator {
            visited_types: FxHashSet::default(),
            field_path: Vec::new(),
            field_path_index_by_type_name: FxHashMap::default(),
        }
    }

    // This does a straight-forward DFS to find cycles.
    // It does not terminate when a cycle was found but continues to explore
    // the graph to find all possible cycles.
    fn detect_cycle_recursive(
        &mut self,
        context: &mut SchemaValidationContext<'s, 'a>,
        input_obj: &'s GraphQLInputObjectType<'a>,
    ) {
        if self.visited_types.contains(input_obj.name) {
            return;
        }

        self.visited_types.insert(input_obj.name);
        self.field_path_index_by_type_name
            .insert(input_obj.name, self.field_path.len());

        let schema = context.schema;
        let fields = input_obj.get_fields();
        for field in fields.values() {
            if let GraphQLType::NonNull(of_type) = &field.r#type
                && let GraphQLType::Named(of_type) = **of_type
                && let GraphQLNamedType::InputObject(field_type) = &schema[of_type]
            {
                let cycle_index = self
                    .field_path_index_by_type_name
                    .get(field_type.name)
                    .copied();

                self.field_path.push(field);
                if let Some(cycle_index) = cycle_index {
                    let cycle_path = &self.field_path[cycle_index..];
                    let path_str = cycle_path
                        .iter()
                        .map(|field_obj| field_obj.name)
                        .collect::<Vec<_>>()
                        .join(".");
                    context.report_error(
                        format!(
                            "Cannot reference Input Object \"{}\" within itself through a series of non-null fields: \"{path_str}\".",
                            field_type.name
                        ),
                        cycle_path
                            .iter()
                            .map(|field_obj| field_obj.ast_node.map(ASTNode::InputValueDefinition)),
                    );
                } else {
                    self.detect_cycle_recursive(context, field_type);
                }
                self.field_path.pop();
            }
        }

        self.field_path_index_by_type_name.remove(input_obj.name);
    }
}

/// PORT: graphql-js reads the fields of object and interface types alike.
fn get_fields<'t, 'a>(r#type: &'t GraphQLNamedType<'a>) -> &'t IndexMap<&'a str, GraphQLField<'a>> {
    match r#type {
        GraphQLNamedType::Object(object_type) => object_type.get_fields(),
        GraphQLNamedType::Interface(interface_type) => interface_type.get_fields(),
        _ => unreachable!("Expected an object or interface type."),
    }
}

/// PORT: graphql-js reads the interfaces of object and interface types alike.
fn get_interfaces<'t>(r#type: &'t GraphQLNamedType) -> &'t [TypeId] {
    match r#type {
        GraphQLNamedType::Object(object_type) => object_type.get_interfaces(),
        GraphQLNamedType::Interface(interface_type) => interface_type.get_interfaces(),
        _ => unreachable!("Expected an object or interface type."),
    }
}

/// PORT: Takes the interface's name, which is all graphql-js reads of it.
fn get_all_implements_interface_nodes<'a>(
    r#type: &GraphQLNamedType<'a>,
    iface_name: &str,
) -> Vec<Option<ASTNode<'a>>> {
    // PORT: The `interfaces` of the type's AST nodes.
    let nodes_interfaces: Vec<&'a Option<Vec<NamedTypeNode>>> = match r#type {
        GraphQLNamedType::Object(object_type) => object_type
            .ast_node
            .map(|node| &node.interfaces)
            .into_iter()
            .chain(
                object_type
                    .extension_ast_nodes
                    .iter()
                    .map(|node| &node.interfaces),
            )
            .collect(),
        GraphQLNamedType::Interface(interface_type) => interface_type
            .ast_node
            .map(|node| &node.interfaces)
            .into_iter()
            .chain(
                interface_type
                    .extension_ast_nodes
                    .iter()
                    .map(|node| &node.interfaces),
            )
            .collect(),
        _ => unreachable!("Expected an object or interface type."),
    };

    nodes_interfaces
        .into_iter()
        // FIXME: https://github.com/graphql/graphql-js/issues/2203
        .flat_map(|interfaces| interfaces.iter().flatten())
        .filter(|iface_node| iface_node.name.value == iface_name)
        .map(|iface_node| Some(ASTNode::NamedType(iface_node)))
        .collect()
}

fn get_union_member_type_nodes<'a>(
    union: &GraphQLUnionType<'a>,
    type_name: &str,
) -> Vec<Option<ASTNode<'a>>> {
    // PORT: The `types` of the union's AST nodes.
    let nodes_types = union
        .ast_node
        .map(|node| &node.types)
        .into_iter()
        .chain(union.extension_ast_nodes.iter().map(|node| &node.types));

    nodes_types
        // FIXME: https://github.com/graphql/graphql-js/issues/2203
        .flat_map(|types| types.iter().flatten())
        .filter(|type_node| type_node.name.value == type_name)
        .map(|type_node| Some(ASTNode::NamedType(type_node)))
        .collect()
}

fn get_deprecated_directive_node(
    definition_node: Option<&InputValueDefinitionNode>,
) -> Option<&ConstDirectiveNode> {
    definition_node?
        .directives
        .as_ref()?
        .iter()
        .find(|node| node.name.value == GRAPHQL_DEPRECATED_DIRECTIVE.name)
}

/// PORT: graphql-js reads the `astNode` and `extensionASTNodes` of any kind
/// of type. This reads them as `ASTNode`s.
trait TypeASTNodes<'a> {
    fn get_ast_node(&self) -> Option<ASTNode<'a>>;

    fn get_extension_ast_nodes(&self) -> Vec<ASTNode<'a>>;

    /// `[type.astNode, ...type.extensionASTNodes]`
    fn get_all_ast_nodes(&self) -> Vec<Option<ASTNode<'a>>> {
        once(self.get_ast_node())
            .chain(self.get_extension_ast_nodes().into_iter().map(Some))
            .collect()
    }
}

macro_rules! impl_type_ast_nodes {
    ($type:ident, $definition:ident, $extension:ident) => {
        impl<'a> TypeASTNodes<'a> for $type<'a> {
            fn get_ast_node(&self) -> Option<ASTNode<'a>> {
                self.ast_node.map(ASTNode::$definition)
            }

            fn get_extension_ast_nodes(&self) -> Vec<ASTNode<'a>> {
                self.extension_ast_nodes
                    .iter()
                    .map(|&node| ASTNode::$extension(node))
                    .collect()
            }
        }
    };
}

impl_type_ast_nodes!(GraphQLScalarType, ScalarTypeDefinition, ScalarTypeExtension);
impl_type_ast_nodes!(GraphQLObjectType, ObjectTypeDefinition, ObjectTypeExtension);
impl_type_ast_nodes!(
    GraphQLInterfaceType,
    InterfaceTypeDefinition,
    InterfaceTypeExtension
);
impl_type_ast_nodes!(GraphQLUnionType, UnionTypeDefinition, UnionTypeExtension);
impl_type_ast_nodes!(GraphQLEnumType, EnumTypeDefinition, EnumTypeExtension);
impl_type_ast_nodes!(
    GraphQLInputObjectType,
    InputObjectTypeDefinition,
    InputObjectTypeExtension
);

impl<'a> TypeASTNodes<'a> for GraphQLNamedType<'a> {
    fn get_ast_node(&self) -> Option<ASTNode<'a>> {
        match self {
            GraphQLNamedType::Scalar(t) => t.get_ast_node(),
            GraphQLNamedType::Object(t) => t.get_ast_node(),
            GraphQLNamedType::Interface(t) => t.get_ast_node(),
            GraphQLNamedType::Union(t) => t.get_ast_node(),
            GraphQLNamedType::Enum(t) => t.get_ast_node(),
            GraphQLNamedType::InputObject(t) => t.get_ast_node(),
        }
    }

    fn get_extension_ast_nodes(&self) -> Vec<ASTNode<'a>> {
        match self {
            GraphQLNamedType::Scalar(t) => t.get_extension_ast_nodes(),
            GraphQLNamedType::Object(t) => t.get_extension_ast_nodes(),
            GraphQLNamedType::Interface(t) => t.get_extension_ast_nodes(),
            GraphQLNamedType::Union(t) => t.get_extension_ast_nodes(),
            GraphQLNamedType::Enum(t) => t.get_extension_ast_nodes(),
            GraphQLNamedType::InputObject(t) => t.get_extension_ast_nodes(),
        }
    }
}
