//! Port of graphql-js `validation/specifiedRules.ts`.
//!
//! PORT: Only `specifiedSDLRules` is ported.

use crate::validation::rules::known_argument_names_rule::known_argument_names_on_directives_rule;
use crate::validation::rules::known_directives_rule::known_directives_rule;
use crate::validation::rules::known_type_names_rule::known_type_names_rule;
use crate::validation::rules::lone_schema_definition_rule::lone_schema_definition_rule;
use crate::validation::rules::possible_type_extensions_rule::possible_type_extensions_rule;
use crate::validation::rules::provided_required_arguments_rule::provided_required_arguments_on_directives_rule;
use crate::validation::rules::unique_argument_definition_names_rule::unique_argument_definition_names_rule;
use crate::validation::rules::unique_argument_names_rule::unique_argument_names_rule;
use crate::validation::rules::unique_directive_names_rule::unique_directive_names_rule;
use crate::validation::rules::unique_directives_per_location_rule::unique_directives_per_location_rule;
use crate::validation::rules::unique_enum_value_names_rule::unique_enum_value_names_rule;
use crate::validation::rules::unique_field_definition_names_rule::unique_field_definition_names_rule;
use crate::validation::rules::unique_input_field_names_rule::unique_input_field_names_rule;
use crate::validation::rules::unique_operation_types_rule::unique_operation_types_rule;
use crate::validation::rules::unique_type_names_rule::unique_type_names_rule;
use crate::validation::validation_context::SDLValidationRule;

pub const SPECIFIED_SDL_RULES: [SDLValidationRule; 15] = [
    lone_schema_definition_rule,
    unique_operation_types_rule,
    unique_type_names_rule,
    unique_enum_value_names_rule,
    unique_field_definition_names_rule,
    unique_argument_definition_names_rule,
    unique_directive_names_rule,
    known_type_names_rule,
    known_directives_rule,
    unique_directives_per_location_rule,
    possible_type_extensions_rule,
    known_argument_names_on_directives_rule,
    unique_argument_names_rule,
    unique_input_field_names_rule,
    provided_required_arguments_on_directives_rule,
];
