//! PORT: `src/tests/Markdown.ts`.

enum Section {
    Header {
        level: usize,
        content: String,
    },
    CodeBlock {
        content: String,
        file_type: String,
        file_name: Option<String>,
    },
}

#[derive(Default)]
pub struct Markdown {
    sections: Vec<Section>,
}

impl Markdown {
    pub fn add_header(&mut self, level: usize, content: &str) {
        self.sections.push(Section::Header {
            level,
            content: content.to_string(),
        });
    }

    pub fn add_code_block(&mut self, content: &str, file_type: &str, file_name: Option<&str>) {
        self.sections.push(Section::CodeBlock {
            content: content.to_string(),
            file_type: file_type.to_string(),
            file_name: file_name.map(str::to_string),
        });
    }

    pub fn add_markdown(&mut self, markdown: Markdown) {
        self.sections.extend(markdown.sections);
    }
}

impl std::fmt::Display for Markdown {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut output = String::new();
        for section in &self.sections {
            match section {
                Section::Header { level, content } => {
                    output += &format!("{} {content}\n\n", "#".repeat(*level));
                }
                Section::CodeBlock {
                    content,
                    file_type,
                    file_name,
                } => {
                    let file_name_part = file_name
                        .as_ref()
                        .map_or(String::new(), |name| format!(" title=\"{name}\""));
                    output += &format!(
                        "```{file_type}{file_name_part}\n{}\n```\n\n",
                        content.trim_end()
                    );
                }
            }
        }
        f.write_str(output.trim())
    }
}
