use graphql_js::language::ast::{
    ConstListValueNode, ConstObjectFieldNode, ConstObjectValueNode, ConstValueNode, DefinitionNode,
    EnumTypeDefinitionNode, EnumValueNode, FieldDefinitionNode, InputObjectTypeDefinitionNode,
    InputValueDefinitionNode, ListTypeNode, NamedTypeNode, NullableTypeNode, TypeNode,
};
use rustc_hash::FxHashMap;

/// This transform visits argument default values checking for values used in
/// enum positions.
///
/// ## String Literals
///
/// If a string literal default value is used in a position that is typed as a
/// GraphQL enum, replace it with an enum value of the same name.
///
/// Grats supports modeling enums as a union of string literals. In this case, a
/// possible default input value for an enum would be a string literal. However,
/// in the GraphQL schema we generate we want the default to be represented as a
/// GraphQL enum, not a string.
///
/// At extraction time, we are not GraphQL type aware, so we don't know if a
/// string literal in a default position is representing an enum variant or a
/// string literal. Instead, we must do this as a fix-up transform after we have
/// collected all types definitions.
///
/// ## Enum Literals
///
/// If we encountered a TypeScript enum in a default value during extraction
/// (`MyEnum.SomeValue`), we just extract it as an enum `SomeValue`. However,
/// the initializer of that TypeScript enum may be some other name. We need to
/// coerce the default value to the correct enum value.
///
/// When we record enum value definitions in the schema, we record the TypeScript
/// name of the enum value as `tsName`. This allows us to look up the correct
/// enum value in this transform by visiting each of the enum values and checking
/// if the `tsName` matches the extracted value.
///
/// Note: If a type-mismatch is encountered the transformation is skipped on the
/// assumption that a later validation pass will detect the error.
pub fn coerce_default_enum_values(mut definitions: Vec<DefinitionNode>) -> Vec<DefinitionNode> {
    let coercer = Coercer::new(&definitions);
    for definition in &mut definitions {
        for node in input_value_definitions(definition) {
            node.default_value = node
                .default_value
                .take()
                .map(|value| coercer.coerce(&node.r#type, value));
        }
    }
    definitions
}

/// The arguments and input fields a definition declares.
fn input_value_definitions(definition: &mut DefinitionNode) -> Vec<&mut InputValueDefinitionNode> {
    fn arguments(
        fields: &mut Option<Vec<FieldDefinitionNode>>,
    ) -> Vec<&mut InputValueDefinitionNode> {
        fields
            .iter_mut()
            .flatten()
            .flat_map(|field| field.arguments.iter_mut().flatten())
            .collect()
    }
    match definition {
        DefinitionNode::ObjectTypeDefinition(def) => arguments(&mut def.fields),
        DefinitionNode::ObjectTypeExtension(def) => arguments(&mut def.fields),
        DefinitionNode::InterfaceTypeDefinition(def) => arguments(&mut def.fields),
        DefinitionNode::InterfaceTypeExtension(def) => arguments(&mut def.fields),
        DefinitionNode::InputObjectTypeDefinition(def) => def.fields.iter_mut().flatten().collect(),
        DefinitionNode::InputObjectTypeExtension(def) => def.fields.iter_mut().flatten().collect(),
        DefinitionNode::DirectiveDefinition(def) => def.arguments.iter_mut().flatten().collect(),
        _ => Vec::new(),
    }
}

/// A type definition, as far as coercion is concerned. The coercer reads these
/// while the transform edits the definitions, so it keeps copies of the ones it
/// reads.
enum CoercerType {
    InputObject(InputObjectTypeDefinitionNode),
    Enum(EnumTypeDefinitionNode),
    Other,
}

struct Coercer {
    types: FxHashMap<String, CoercerType>,
}

impl Coercer {
    fn new(definitions: &[DefinitionNode]) -> Self {
        let types = definitions
            .iter()
            .filter_map(|definition| {
                let (name, t) = match definition {
                    DefinitionNode::InputObjectTypeDefinition(def) => {
                        (&def.name, CoercerType::InputObject(def.clone()))
                    }
                    DefinitionNode::EnumTypeDefinition(def) => {
                        (&def.name, CoercerType::Enum(def.clone()))
                    }
                    DefinitionNode::ScalarTypeDefinition(def) => (&def.name, CoercerType::Other),
                    DefinitionNode::ObjectTypeDefinition(def) => (&def.name, CoercerType::Other),
                    DefinitionNode::InterfaceTypeDefinition(def) => (&def.name, CoercerType::Other),
                    DefinitionNode::UnionTypeDefinition(def) => (&def.name, CoercerType::Other),
                    _ => return None,
                };
                Some((name.value.clone(), t))
            })
            .collect();
        Coercer { types }
    }

    fn coerce(&self, parent_type: &TypeNode, value: ConstValueNode) -> ConstValueNode {
        match parent_type {
            TypeNode::NonNullType(parent_type) => match parent_type.r#type.as_ref() {
                NullableTypeNode::NamedType(parent_type) => {
                    self.coerce_named_type(parent_type, value)
                }
                NullableTypeNode::ListType(parent_type) => {
                    self.coerce_list_type(parent_type, value)
                }
            },
            TypeNode::NamedType(parent_type) => self.coerce_named_type(parent_type, value),
            TypeNode::ListType(parent_type) => self.coerce_list_type(parent_type, value),
        }
    }

    fn coerce_list_type(
        &self,
        parent_type: &ListTypeNode,
        value: ConstValueNode,
    ) -> ConstValueNode {
        let ConstValueNode::ListValue(value) = value else {
            return value;
        };
        ConstValueNode::ListValue(ConstListValueNode {
            values: value
                .values
                .into_iter()
                .map(|item| self.coerce(&parent_type.r#type, item))
                .collect(),
            ..value
        })
    }

    fn coerce_named_type(
        &self,
        parent_type: &NamedTypeNode,
        value: ConstValueNode,
    ) -> ConstValueNode {
        match self.types.get(&parent_type.name.value) {
            Some(CoercerType::InputObject(parent_type)) => {
                self.coerce_input_object(parent_type, value)
            }
            Some(CoercerType::Enum(parent_type)) => coerce_to_enum(parent_type, value),
            Some(CoercerType::Other) | None => value,
        }
    }

    fn coerce_input_object(
        &self,
        parent_type: &InputObjectTypeDefinitionNode,
        value: ConstValueNode,
    ) -> ConstValueNode {
        let ConstValueNode::ObjectValue(value) = value else {
            return value;
        };
        let fields = value
            .fields
            .into_iter()
            .map(|field| {
                let field_def = parent_type
                    .fields
                    .iter()
                    .flatten()
                    .find(|def| def.name.value == field.name.value);
                match field_def {
                    Some(field_def) => ConstObjectFieldNode {
                        value: self.coerce(&field_def.r#type, field.value),
                        ..field
                    },
                    None => field,
                }
            })
            .collect();
        ConstValueNode::ObjectValue(ConstObjectValueNode { fields, ..value })
    }
}

fn coerce_to_enum(enum_def: &EnumTypeDefinitionNode, value: ConstValueNode) -> ConstValueNode {
    match value {
        ConstValueNode::EnumValue(value) => {
            let enum_value = enum_def
                .values
                .iter()
                .flatten()
                .find(|enum_value| enum_value.ts_name.as_ref() == Some(&value.value));
            match enum_value {
                Some(enum_value) => ConstValueNode::EnumValue(EnumValueNode {
                    value: enum_value.name.value.clone(),
                    ..value
                }),
                None => ConstValueNode::EnumValue(value),
            }
        }
        ConstValueNode::StringValue(value) => ConstValueNode::EnumValue(EnumValueNode {
            loc: value.loc,
            value: value.value,
        }),
        value => value,
    }
}
