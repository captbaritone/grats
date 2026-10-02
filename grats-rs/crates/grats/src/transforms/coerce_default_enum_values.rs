//! Port of `src/transforms/coerceDefaultEnumValues.ts`.

use std::collections::HashMap;

use graphql_js::language::ast::{
    ConstListValueNode, ConstObjectFieldNode, ConstObjectValueNode, ConstValueNode, DefinitionNode,
    EnumTypeDefinitionNode, EnumValueNode, FieldDefinitionNode, InputObjectTypeDefinitionNode,
    InputValueDefinitionNode, ListTypeNode, NamedTypeNode, NullableTypeNode, TypeNode,
};

/**
 * This transform visits argument default values checking for values used in
 * enum positions.
 *
 * ## String Literals
 *
 * If a string literal default value is used in a position that is typed as a
 * GraphQL enum, replace it with an enum value of the same name.
 *
 * Grats supports modeling enums as a union of string literals. In this case, a
 * possible default input value for an enum would be a string literal. However,
 * in the GraphQL schema we generate we want the default to be repetend as an
 * GraphQL enum, not a string.
 *
 * At extraction time, we are not GraphQL type aware, so we don't know if a
 * string literal in a default position is representing an enum variant or a
 * string literal. Instead, we must do this as a fix-up transform after we have
 * collected all types definitions.
 *
 * ## Enum Literals
 *
 * If we encountered a TypeScript enum in a default value during extraction
 * (`MyEnum.SomeValue`), we just extract it as an enum `SomeValue`. However,
 * the initializer of that TypeScript enum may be some other name. We need to
 * coerce the default value to the correct enum value.
 *
 * When we record enum value definitions in the schema, we record the TypeScript
 * name of the enum value as `tsName`. This allows us to look up the correct
 * enum value in this transform by visiting each of the enum values and checking
 * if the `tsName` matches the extracted value.
 *
 * Note: If a type-mismatch is encountered the transformation is skipped on the
 * assumption that a later validation pass will detect the error.
 *
 * PORT: TypeScript uses graphql-js's `visit` to replace input value
 * definitions with coerced copies. The Rust visitor can't edit the AST, so
 * this coerces default values in place, walking to every input value
 * definition.
 */
pub fn coerce_default_enum_values(mut definitions: Vec<DefinitionNode>) -> Vec<DefinitionNode> {
    let coercer = Coercer::new(&definitions);

    for def in &mut definitions {
        for node in input_value_definitions(def) {
            let Some(default_value) = node.default_value.take() else {
                continue;
            };
            node.default_value = Some(coercer.coerce(&node.r#type, default_value));
        }
    }

    definitions
}

/// PORT: The input value definitions `visit` would call the visitor with.
fn input_value_definitions(def: &mut DefinitionNode) -> Vec<&mut InputValueDefinitionNode> {
    fn arguments(
        fields: &mut Option<Vec<FieldDefinitionNode>>,
    ) -> Vec<&mut InputValueDefinitionNode> {
        fields
            .iter_mut()
            .flatten()
            .flat_map(|field| field.arguments.iter_mut().flatten())
            .collect()
    }
    match def {
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

/// PORT: TypeScript maps names to the type definitions themselves. Rust edits
/// the definitions while the coercer reads them, so it keeps copies of the
/// ones it reads, and only the kind of the others.
enum CoercerType {
    InputObject(InputObjectTypeDefinitionNode),
    Enum(EnumTypeDefinitionNode),
    Other,
}

struct Coercer {
    types: HashMap<String, CoercerType>,
}

impl Coercer {
    fn new(definitions: &[DefinitionNode]) -> Self {
        let mut types = HashMap::new();
        for def in definitions {
            // PORT: `isTypeDefinitionNode(def)`.
            let (name, t) = match def {
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
                _ => continue,
            };
            types.insert(name.value.clone(), t);
        }
        Coercer { types }
    }

    fn coerce(&self, parent_type: &TypeNode, value: ConstValueNode) -> ConstValueNode {
        match parent_type {
            // PORT: A non-null type wraps a `NullableTypeNode`, so this
            // matches on it rather than recursing with a `TypeNode`.
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
        parent_named_type: &ListTypeNode,
        value: ConstValueNode,
    ) -> ConstValueNode {
        let ConstValueNode::ListValue(value) = value else {
            return value;
        };

        let mut new_values: Vec<ConstValueNode> = Vec::new();
        for v in value.values {
            let new_value = self.coerce(&parent_named_type.r#type, v);
            new_values.push(new_value);
        }
        ConstValueNode::ListValue(ConstListValueNode {
            values: new_values,
            ..value
        })
    }

    fn coerce_named_type(
        &self,
        parent_named_type: &NamedTypeNode,
        value: ConstValueNode,
    ) -> ConstValueNode {
        let Some(parent_type) = self.types.get(&parent_named_type.name.value) else {
            return value;
        };

        match parent_type {
            CoercerType::InputObject(parent_type) => self.coerce_input_object(parent_type, value),
            CoercerType::Enum(parent_type) => self.coerce_to_enum(parent_type, value),
            CoercerType::Other => value,
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

        let new_fields = value
            .fields
            .into_iter()
            .map(|field| {
                let field_def = parent_type
                    .fields
                    .iter()
                    .flatten()
                    .find(|def| def.name.value == field.name.value);
                let Some(field_def) = field_def else {
                    return field;
                };

                self.coerce_field(&field_def.r#type, field)
            })
            .collect();
        ConstValueNode::ObjectValue(ConstObjectValueNode {
            fields: new_fields,
            ..value
        })
    }

    fn coerce_field(
        &self,
        parent_type: &TypeNode,
        field: ConstObjectFieldNode,
    ) -> ConstObjectFieldNode {
        ConstObjectFieldNode {
            value: self.coerce(parent_type, field.value),
            ..field
        }
    }

    fn coerce_to_enum(
        &self,
        enum_def: &EnumTypeDefinitionNode,
        value: ConstValueNode,
    ) -> ConstValueNode {
        match value {
            ConstValueNode::EnumValue(value) => {
                if let Some(values) = &enum_def.values {
                    for enum_value in values {
                        if enum_value.ts_name.as_ref() == Some(&value.value) {
                            return ConstValueNode::EnumValue(EnumValueNode {
                                value: enum_value.name.value.clone(),
                                ..value
                            });
                        }
                    }
                }
                ConstValueNode::EnumValue(value)
            }
            ConstValueNode::StringValue(value) => ConstValueNode::EnumValue(EnumValueNode {
                loc: value.loc,
                value: value.value,
            }),
            value => value,
        }
    }
}
