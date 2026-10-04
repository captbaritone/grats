//! Where the members of a JSON document are, so a diagnostic can point at one
//! and a fix can edit it.
//!
//! `tsconfig.json` is JSON with comments and trailing commas, and Grats reads
//! it with `serde_json` after stripping the comments. That loses positions,
//! and strips them from a copy, so offsets into it wouldn't match the file on
//! disk. This scans the original text instead, recording the span of each
//! member's key and value by the path of object keys which reach it.
//!
//! It records member spans and nothing else: arrays are traversed so that
//! objects inside them don't confuse the key stack, but their elements aren't
//! addressable.

use std::ops::Range;

use rustc_hash::FxHashMap;

/// The spans of a JSON document's members, by their path of object keys.
#[derive(Debug, Default)]
pub struct Spans {
    keys: FxHashMap<Vec<String>, Range<usize>>,
    values: FxHashMap<Vec<String>, Range<usize>>,
    /// Where a new member may be inserted in each object: just inside its
    /// `{`, with whether the object already has any members.
    objects: FxHashMap<Vec<String>, Object>,
}

#[derive(Debug)]
struct Object {
    /// The span of the whole object, braces included.
    span: Range<usize>,
    first_member: Option<usize>,
}

/// An edit to apply to the document's text.
pub struct Edit {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

impl Spans {
    /// The span of the key at `path`, quotes included.
    pub fn key(&self, path: &[&str]) -> Option<&Range<usize>> {
        self.keys.get(&owned(path))
    }

    /// The span of the value at `path`.
    pub fn value(&self, path: &[&str]) -> Option<&Range<usize>> {
        self.values.get(&owned(path))
    }

    /// A UTF-16 offset, which is what `Location` and a fix's spans use.
    pub fn to_utf16(&self, text: &str, offset: usize) -> u32 {
        text[..offset].encode_utf16().count() as u32
    }

    /// An edit which gives `parent.key` the value `value`, replacing the
    /// existing value or inserting the member. `None` if `parent` isn't an
    /// object in this document, since then there's nowhere to put it.
    pub fn set_member(&self, text: &str, parent: &[&str], key: &str, value: &str) -> Option<Edit> {
        let mut path = owned(parent);
        path.push(key.to_string());
        if let Some(span) = self.values.get(&path) {
            return Some(Edit {
                start: span.start,
                end: span.end,
                text: value.to_string(),
            });
        }
        let object = self.objects.get(&owned(parent))?;
        // Indent the new member like the first one, or one level in from the
        // line the object opens on.
        let anchor = object.first_member.unwrap_or(object.span.start);
        let indent = line_indent(text, anchor);
        let (indent, trailing) = match object.first_member {
            Some(_) => (indent, ","),
            None => (format!("{indent}  "), ""),
        };
        let at = object.span.start + 1;
        Some(Edit {
            start: at,
            end: at,
            text: format!("\n{indent}\"{key}\": {value}{trailing}"),
        })
    }
}

fn owned(path: &[&str]) -> Vec<String> {
    path.iter().map(|segment| segment.to_string()).collect()
}

/// The indentation of the line `offset` falls on.
fn line_indent(text: &str, offset: usize) -> String {
    let line_start = text[..offset].rfind('\n').map_or(0, |index| index + 1);
    text[line_start..offset]
        .chars()
        .take_while(|ch| *ch == ' ' || *ch == '\t')
        .collect()
}

/// The text of a value span, with the quotes removed from a string, so a
/// caller can compare it against an expected value.
pub fn value_text(text: &str, span: &Range<usize>) -> Option<String> {
    let raw = text.get(span.clone())?.trim();
    Some(
        match raw
            .strip_prefix('"')
            .and_then(|rest| rest.strip_suffix('"'))
        {
            Some(inner) => inner.to_string(),
            None => raw.to_string(),
        },
    )
}

/// Scans `text`, recording where each object member's key and value are.
pub fn scan(text: &str) -> Spans {
    Scanner {
        bytes: text.as_bytes(),
        text,
        pos: 0,
        path: Vec::new(),
        spans: Spans::default(),
    }
    .run()
}

struct Scanner<'a> {
    bytes: &'a [u8],
    text: &'a str,
    pos: usize,
    path: Vec<String>,
    spans: Spans,
}

impl<'a> Scanner<'a> {
    fn run(mut self) -> Spans {
        self.skip_trivia();
        self.value();
        self.spans
    }

    fn skip_trivia(&mut self) {
        loop {
            while self.pos < self.bytes.len() && self.bytes[self.pos].is_ascii_whitespace() {
                self.pos += 1;
            }
            if self.bytes[self.pos..].starts_with(b"//") {
                self.pos += 2;
                while self.pos < self.bytes.len() && self.bytes[self.pos] != b'\n' {
                    self.pos += 1;
                }
            } else if self.bytes[self.pos..].starts_with(b"/*") {
                self.pos += 2;
                while self.pos < self.bytes.len() && !self.bytes[self.pos..].starts_with(b"*/") {
                    self.pos += 1;
                }
                self.pos = (self.pos + 2).min(self.bytes.len());
            } else {
                return;
            }
        }
    }

    fn value(&mut self) {
        match self.bytes.get(self.pos) {
            Some(b'{') => self.object(),
            Some(b'[') => self.array(),
            Some(b'"') => {
                self.string();
            }
            _ => self.primitive(),
        }
    }

    fn object(&mut self) {
        let start = self.pos;
        self.pos += 1; // `{`
        let mut first_member = None;
        loop {
            self.skip_trivia();
            match self.bytes.get(self.pos) {
                None => break,
                Some(b'}') => {
                    self.pos += 1;
                    break;
                }
                Some(b',') => {
                    self.pos += 1;
                    continue;
                }
                Some(b'"') => {}
                // Not valid JSON; step over it rather than spin.
                _ => {
                    self.pos += 1;
                    continue;
                }
            }
            let key_span = self.string();
            let key = self.text[key_span.start + 1..key_span.end - 1].to_string();
            first_member.get_or_insert(key_span.start);
            self.skip_trivia();
            if self.bytes.get(self.pos) == Some(&b':') {
                self.pos += 1;
            }
            self.skip_trivia();
            let value_start = self.pos;
            self.path.push(key);
            self.value();
            let value_end = self.pos;
            self.spans.keys.insert(self.path.clone(), key_span);
            self.spans
                .values
                .insert(self.path.clone(), value_start..value_end);
            self.path.pop();
        }
        let path = self.path.clone();
        self.spans.objects.insert(
            path,
            Object {
                span: start..self.pos,
                first_member,
            },
        );
    }

    fn array(&mut self) {
        self.pos += 1; // `[`
        loop {
            self.skip_trivia();
            match self.bytes.get(self.pos) {
                None => break,
                Some(b']') => {
                    self.pos += 1;
                    break;
                }
                Some(b',') => {
                    self.pos += 1;
                }
                _ => self.value(),
            }
        }
    }

    fn string(&mut self) -> Range<usize> {
        let start = self.pos;
        self.pos += 1; // `"`
        while self.pos < self.bytes.len() {
            match self.bytes[self.pos] {
                b'\\' => self.pos += 2,
                b'"' => {
                    self.pos += 1;
                    break;
                }
                _ => self.pos += 1,
            }
        }
        start..self.pos.min(self.bytes.len())
    }

    fn primitive(&mut self) {
        while self.pos < self.bytes.len()
            && !matches!(self.bytes[self.pos], b',' | b'}' | b']')
            && !self.bytes[self.pos].is_ascii_whitespace()
        {
            self.pos += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONFIG: &str = r#"{
  // A leading comment, which the spans must see past.
  "grats": {
    "importModuleSpecifierEnding": ".ts"
  },
  "compilerOptions": {
    "module": "nodenext",
    "lib": ["esnext"],
    "paths": { "a": ["./a"] }
  },
  "include": ["src"]
}"#;

    fn text_at(text: &str, span: &Range<usize>) -> String {
        text[span.clone()].to_string()
    }

    #[test]
    fn finds_nested_keys_and_values() {
        let spans = scan(CONFIG);
        assert_eq!(
            text_at(
                CONFIG,
                spans
                    .key(&["grats", "importModuleSpecifierEnding"])
                    .unwrap()
            ),
            "\"importModuleSpecifierEnding\""
        );
        assert_eq!(
            text_at(
                CONFIG,
                spans
                    .value(&["grats", "importModuleSpecifierEnding"])
                    .unwrap()
            ),
            "\".ts\""
        );
        assert_eq!(
            text_at(CONFIG, spans.value(&["compilerOptions", "module"]).unwrap()),
            "\"nodenext\""
        );
    }

    #[test]
    fn arrays_do_not_shift_the_key_path() {
        // `paths` comes after an array, and a key inside an array's object
        // must not be mistaken for a member of the enclosing object.
        let spans = scan(CONFIG);
        assert!(spans.value(&["compilerOptions", "paths"]).is_some());
        assert!(spans.value(&["compilerOptions", "a"]).is_none());
        assert!(spans.value(&["include"]).is_some());
    }

    #[test]
    fn value_text_unwraps_strings_but_not_literals() {
        let spans = scan(CONFIG);
        let module = spans.value(&["compilerOptions", "module"]).unwrap();
        assert_eq!(value_text(CONFIG, module).as_deref(), Some("nodenext"));
        let spans = scan(r#"{ "a": { "b": true } }"#);
        let b = spans.value(&["a", "b"]).unwrap();
        assert_eq!(
            value_text(r#"{ "a": { "b": true } }"#, b).as_deref(),
            Some("true")
        );
    }

    fn apply(text: &str, edit: Edit) -> String {
        format!("{}{}{}", &text[..edit.start], edit.text, &text[edit.end..])
    }

    #[test]
    fn replaces_a_value_which_is_already_there() {
        let spans = scan(CONFIG);
        let edit = spans
            .set_member(CONFIG, &["grats"], "importModuleSpecifierEnding", "\".js\"")
            .unwrap();
        assert!(apply(CONFIG, edit).contains("\"importModuleSpecifierEnding\": \".js\""));
    }

    #[test]
    fn inserts_a_member_matching_the_existing_indentation() {
        let spans = scan(CONFIG);
        let edit = spans
            .set_member(
                CONFIG,
                &["compilerOptions"],
                "allowImportingTsExtensions",
                "true",
            )
            .unwrap();
        let updated = apply(CONFIG, edit);
        assert!(updated.contains("    \"allowImportingTsExtensions\": true,\n    \"module\""));
        // The comment, and everything else, survives a surgical edit.
        assert!(updated.contains("// A leading comment"));
    }

    #[test]
    fn inserts_into_an_empty_object() {
        let text = "{\n  \"grats\": {},\n  \"include\": [\"src\"]\n}";
        let spans = scan(text);
        let edit = spans
            .set_member(text, &["grats"], "importModuleSpecifierEnding", "\".js\"")
            .unwrap();
        assert!(apply(text, edit).contains("\"importModuleSpecifierEnding\": \".js\""));
    }

    #[test]
    fn reports_nothing_for_a_parent_which_is_not_an_object() {
        let text = r#"{ "grats": "nope" }"#;
        let spans = scan(text);
        assert!(spans.set_member(text, &["grats"], "a", "1").is_none());
    }

    #[test]
    fn utf16_offsets_account_for_wide_characters() {
        let text = "{\n  \"héllo\": \"🌍\",\n  \"grats\": {}\n}";
        let spans = scan(text);
        let span = spans.key(&["grats"]).unwrap();
        // The emoji is one char but two UTF-16 units, so the UTF-16 offset
        // is greater than the char count before it.
        assert!(spans.to_utf16(text, span.start) > 0);
        assert!((spans.to_utf16(text, span.start) as usize) < span.start);
    }
}
