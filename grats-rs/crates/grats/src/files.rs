//! PORT: No TypeScript counterpart. The files of the program, which are
//! parsed with oxc as they're loaded (see `crate::program`). Like the
//! `SourceFile`s of a `ts.Program`, each file is parsed once and shared by
//! everything which reads it: the program's file walk, the extractor and the
//! name resolver. Semantic analysis only runs on the files that need it.

use std::cell::{OnceCell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;

use oxc_allocator::Allocator;
use oxc_ast::AstKind;
use oxc_ast::ast::Program;
use oxc_parser::config::TokensParserConfig;
use oxc_parser::{Kind, Parser, Token};
use oxc_semantic::{NodeId, Semantic, SemanticBuilder};
use oxc_span::{GetSpan, SourceType, Span};

use crate::host::Host;
use crate::jsdoc::JSDocIndex;
use crate::source_table::SourceTable;

pub struct Files<'a> {
    allocator: &'a Allocator,
    pub host: &'a dyn Host,
    pub sources: &'a SourceTable,
    /// Whether paths which differ only in case name different files.
    use_case_sensitive_file_names: bool,
    /// The files loaded so far, by their key (see `key`), or `None` if a
    /// path couldn't be read.
    files: RefCell<HashMap<String, Option<Rc<ParsedFile<'a>>>>>,
    /// The paths of the sources of the files loaded so far.
    source_paths: RefCell<HashMap<u32, String>>,
}

pub struct ParsedFile<'a> {
    pub source: u32,
    pub path: String,
    pub text: &'a str,
    pub source_type: SourceType,
    pub is_module: bool,
    pub is_declaration_file: bool,
    pub program: &'a Program<'a>,
    /// The file's tokens, in order, without its hashbang or comments.
    tokens: &'a [Token],
    pub offsets: Utf16Offsets,
    /// The syntax errors oxc encountered while parsing the file.
    pub syntax_errors: Vec<SyntaxError>,
    /// Built the first time it's needed.
    semantic: OnceCell<Semantic<'a>>,
    /// The names which a location may refer to, by their span. Used by the
    /// name resolver. Built the first time it's needed.
    names: OnceCell<HashMap<(u32, u32), NodeId>>,
    /// The file's JSDoc, by the node it's attached to. Built the first time
    /// it's needed.
    jsdoc: OnceCell<JSDocIndex>,
}

pub struct SyntaxError {
    pub span: Span,
    pub message: String,
}

impl<'a> Files<'a> {
    pub fn new(
        allocator: &'a Allocator,
        host: &'a dyn Host,
        sources: &'a SourceTable,
        use_case_sensitive_file_names: bool,
    ) -> Self {
        Files {
            allocator,
            host,
            sources,
            use_case_sensitive_file_names,
            files: RefCell::new(HashMap::new()),
            source_paths: RefCell::new(HashMap::new()),
        }
    }

    /// Like TypeScript's `toPath`: the key which identifies the file at
    /// `path`.
    pub fn key(&self, path: &str) -> String {
        if self.use_case_sensitive_file_names {
            path.to_string()
        } else {
            path.to_lowercase()
        }
    }

    /// The file of a source which a location refers to.
    pub fn source_file(&self, source: u32) -> Rc<ParsedFile<'a>> {
        let path = self.source_paths.borrow().get(&source).cloned();
        path.and_then(|path| self.file(&path))
            .unwrap_or_else(|| panic!("Expected source {source} to be a loaded file."))
    }

    /// The file at `path`, or `None` if it hasn't been loaded (it isn't in
    /// the program) or couldn't be read.
    pub fn file(&self, path: &str) -> Option<Rc<ParsedFile<'a>>> {
        self.files.borrow().get(&self.key(path)).cloned().flatten()
    }

    /// Whether `load` has been called with `path`.
    pub fn is_loaded(&self, path: &str) -> bool {
        self.files.borrow().contains_key(&self.key(path))
    }

    /// Reads and parses the file at `path`, unless it has already been
    /// loaded. `is_module` decides whether the file is a module from its
    /// syntax.
    pub fn load(
        &self,
        path: &str,
        is_module: impl FnOnce(&Program<'a>, SourceType) -> bool,
    ) -> Option<Rc<ParsedFile<'a>>> {
        let key = self.key(path);
        if let Some(file) = self.files.borrow().get(&key) {
            return file.clone();
        }
        let file = self.host.read_file(path).map(|text| {
            let source = self.sources.add(path, &text);
            self.source_paths
                .borrow_mut()
                .insert(source, path.to_string());
            Rc::new(self.parse(source, path, &text, is_module))
        });
        self.files.borrow_mut().insert(key, file.clone());
        file
    }

    fn parse(
        &self,
        source: u32,
        path: &str,
        text: &str,
        is_module: impl FnOnce(&Program<'a>, SourceType) -> bool,
    ) -> ParsedFile<'a> {
        let text = self.allocator.alloc_str(text);
        let mut source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::ts());
        // Like `getLanguageVariant`, JavaScript files may contain JSX.
        if source_type.is_javascript() {
            source_type = source_type.with_jsx(true);
        }
        let parsed = Parser::new(self.allocator, text, source_type)
            .with_config(TokensParserConfig)
            .parse();
        let syntax_errors = parsed
            .diagnostics
            .errors()
            .map(|error| {
                let label = error
                    .labels
                    .iter()
                    .find(|label| label.primary())
                    .or(error.labels.first());
                SyntaxError {
                    span: label.map_or(Span::empty(0), |label| {
                        Span::sized(label.offset(), label.len())
                    }),
                    message: error.message.to_string(),
                }
            })
            .collect();
        let program = self.allocator.alloc(parsed.program);
        let tokens = self.allocator.alloc(parsed.tokens);
        ParsedFile {
            source,
            path: path.to_string(),
            text,
            source_type,
            is_module: is_module(program, source_type),
            is_declaration_file: source_type.is_typescript_definition(),
            program,
            tokens,
            offsets: Utf16Offsets::new(text),
            syntax_errors,
            semantic: OnceCell::new(),
            names: OnceCell::new(),
            jsdoc: OnceCell::new(),
        }
    }
}

impl<'a> ParsedFile<'a> {
    /// The first token which starts at or after `pos`.
    pub fn token_after(&self, pos: u32) -> Option<&Token> {
        let index = self.tokens.partition_point(|token| token.start() < pos);
        self.tokens.get(index)
    }

    /// The last token which ends at or before `pos`.
    pub fn token_before(&self, pos: u32) -> Option<&Token> {
        let index = self.tokens.partition_point(|token| token.end() <= pos);
        index.checked_sub(1).map(|index| &self.tokens[index])
    }

    /// PORT: A node's `pos`, its "full start": the end of the token before
    /// `start`, so it includes the trivia before it.
    pub fn full_start(&self, start: u32) -> u32 {
        self.token_before(start).map_or(0, Token::end)
    }

    /// The span of the `kind` token between `from` and `to`, if there is one.
    pub fn find_token(&self, from: u32, to: u32, kind: Kind) -> Option<Span> {
        let start = self.tokens.partition_point(|token| token.start() < from);
        self.tokens[start..]
            .iter()
            .take_while(|token| token.end() <= to)
            .find(|token| token.kind() == kind)
            .map(Token::span)
    }

    /// The file's scopes, symbols and nodes.
    pub fn semantic(&self) -> &Semantic<'a> {
        self.semantic.get_or_init(|| {
            SemanticBuilder::new()
                .with_build_nodes(true)
                .build(self.program)
                .semantic
        })
    }

    /// The names which a location may refer to, by their span.
    pub fn names(&self) -> &HashMap<(u32, u32), NodeId> {
        self.names.get_or_init(|| {
            self.semantic()
                .nodes()
                .iter()
                .filter(|node| {
                    matches!(
                        node.kind(),
                        AstKind::IdentifierReference(_)
                            | AstKind::TSQualifiedName(_)
                            | AstKind::BindingIdentifier(_)
                    )
                })
                .map(|node| {
                    let span = node.kind().span();
                    ((span.start, span.end), node.id())
                })
                .collect()
        })
    }

    /// The file's JSDoc, by the node it's attached to.
    pub fn jsdoc(&self) -> &JSDocIndex {
        self.jsdoc.get_or_init(|| JSDocIndex::new(self))
    }
}

/// Converts between oxc's UTF-8 offsets and the UTF-16 offsets of
/// locations.
pub struct Utf16Offsets {
    /// The offsets after each character which isn't ASCII, between which
    /// offsets differ by the same amount.
    checkpoints: Vec<(u32, u32)>,
}

impl Utf16Offsets {
    pub fn new(text: &str) -> Self {
        let mut checkpoints = Vec::new();
        let mut utf16 = 0;
        for (utf8, c) in text.char_indices() {
            utf16 += c.len_utf16();
            if !c.is_ascii() {
                checkpoints.push(((utf8 + c.len_utf8()) as u32, utf16 as u32));
            }
        }
        Utf16Offsets { checkpoints }
    }

    pub fn to_utf16(&self, utf8: u32) -> u32 {
        match self.checkpoints.partition_point(|&(b, _)| b <= utf8) {
            0 => utf8,
            i => {
                let (b, u) = self.checkpoints[i - 1];
                u + (utf8 - b)
            }
        }
    }

    pub fn to_utf8(&self, utf16: u32) -> u32 {
        match self.checkpoints.partition_point(|&(_, u)| u <= utf16) {
            0 => utf16,
            i => {
                let (b, u) = self.checkpoints[i - 1];
                b + (utf16 - u)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Utf16Offsets;

    #[test]
    fn converts_offsets() {
        // "é" is 2 bytes and 1 UTF-16 unit, "😀" 4 bytes and 2 units.
        let offsets = Utf16Offsets::new("aé b😀c");
        for (utf8, utf16) in [(0, 0), (1, 1), (3, 2), (5, 4), (9, 6), (10, 7)] {
            assert_eq!(offsets.to_utf16(utf8), utf16);
            assert_eq!(offsets.to_utf8(utf16), utf8);
        }
    }
}
