//! Port of `src/Extractor.ts`.
//!
//! PORT: Only the constants used by ported code.

pub const FIELD_TAG: &str = "gqlField";
pub const TYPE_TAG: &str = "gqlType";
pub const INTERFACE_TAG: &str = "gqlInterface";

pub const CONTEXT_TAG: &str = "gqlContext";
pub const INFO_TAG: &str = "gqlInfo";

pub const KILLS_PARENT_ON_EXCEPTION_TAG: &str = "killsParentOnException";

pub const OPERATION_TYPES: [&str; 3] = ["Query", "Mutation", "Subscription"];
