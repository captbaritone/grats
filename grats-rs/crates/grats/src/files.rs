//! PORT: No TypeScript counterpart. The files of the program, which are
//! parsed with oxc as they're needed. Like the `SourceFile`s of a
//! `ts.Program`, each file is parsed once and shared by everything which
//! reads it: the extractor and the name resolver.

use std::cell::{OnceCell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;

use oxc_allocator::Allocator;
use oxc_ast::AstKind;
use oxc_parser::Parser;
use oxc_semantic::{NodeId, Semantic, SemanticBuilder};
use oxc_span::{GetSpan, SourceType};

use crate::host::{File, Host};
use crate::jsdoc::JSDocIndex;

pub struct Files<'a> {
    allocator: &'a Allocator,
    pub host: &'a dyn Host,
    /// Parsed files by path, or `None` if the path isn't in the program.
    files: RefCell<HashMap<String, Option<Rc<ParsedFile<'a>>>>>,
    /// The paths of the sources locations have referred to.
    source_paths: RefCell<HashMap<u32, String>>,
}

pub struct ParsedFile<'a> {
    pub source: u32,
    pub path: String,
    pub text: &'a str,
    pub is_module: bool,
    pub is_declaration_file: bool,
    pub semantic: Semantic<'a>,
    pub offsets: Utf16Offsets,
    /// The names which a location may refer to, by their span. Used by the
    /// name resolver.
    pub names: HashMap<(u32, u32), NodeId>,
    /// The file's JSDoc, by the node it's attached to. Built the first time
    /// it's needed.
    jsdoc: OnceCell<JSDocIndex>,
}

impl<'a> Files<'a> {
    pub fn new(allocator: &'a Allocator, host: &'a dyn Host) -> Self {
        Files {
            allocator,
            host,
            files: RefCell::new(HashMap::new()),
            source_paths: RefCell::new(HashMap::new()),
        }
    }

    /// The file of a source which a location refers to.
    pub fn source_file(&self, source: u32) -> Rc<ParsedFile<'a>> {
        let path = self.source_paths.borrow().get(&source).cloned();
        if let Some(file) = path.and_then(|path| self.file(&path)) {
            return file;
        }
        let file = self.host.source_file(source);
        let path = file.path.clone();
        self.source_paths.borrow_mut().insert(source, path.clone());
        let parsed = Rc::new(self.parse(file));
        self.files
            .borrow_mut()
            .insert(path, Some(Rc::clone(&parsed)));
        parsed
    }

    /// The file at `path`, or `None` if it isn't in the program.
    pub fn file(&self, path: &str) -> Option<Rc<ParsedFile<'a>>> {
        if let Some(file) = self.files.borrow().get(path) {
            return file.clone();
        }
        let file = self
            .host
            .read_file(path)
            .map(|file| Rc::new(self.parse(file)));
        self.files
            .borrow_mut()
            .insert(path.to_string(), file.clone());
        file
    }

    fn parse(&self, file: File) -> ParsedFile<'a> {
        let text = self.allocator.alloc_str(&file.text);
        let source_type = SourceType::from_path(&file.path).unwrap_or_else(|_| SourceType::ts());
        let program = self.allocator.alloc(
            Parser::new(self.allocator, text, source_type)
                .parse()
                .program,
        );
        let semantic = SemanticBuilder::new()
            .with_build_nodes(true)
            .build(program)
            .semantic;
        let names = semantic
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
            .collect();
        ParsedFile {
            source: file.source,
            path: file.path,
            text,
            is_module: file.is_module,
            is_declaration_file: source_type.is_typescript_definition(),
            offsets: Utf16Offsets::new(text),
            semantic,
            names,
            jsdoc: OnceCell::new(),
        }
    }
}

impl ParsedFile<'_> {
    /// The file's JSDoc, by the node it's attached to.
    pub fn jsdoc(&self) -> &JSDocIndex {
        self.jsdoc
            .get_or_init(|| JSDocIndex::new(self.text, &self.semantic))
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
