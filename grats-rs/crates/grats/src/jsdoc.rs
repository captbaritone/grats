//! Finds each declaration's JSDoc and parses its tags, following
//! TypeScript's rules (5.9.2) over oxc's AST: which nodes comments attach to,
//! how they're parsed, and which tags each node sees. Grats' behavior (error
//! locations, fixes and descriptions) depends on their exact results, which
//! oxc's JSDoc support doesn't reproduce.

mod nodes;
mod parser;
mod scanner;
mod utilities;

pub use nodes::{JSDocId, JSDocIndex, SyntaxKind, TagId, TsNode, TsNodeId};
pub use parser::{JSDoc, JSDocComment, JSDocCommentPart, JSDocLinkKind, JSDocTag};
pub use scanner::{CommentKind, CommentRange, is_js_white_space, is_line_break, js_trim};
pub use utilities::{JSDocOrTag, get_text_of_js_doc_comment};
