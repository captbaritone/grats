type MarkdownSection =
  | {
      kind: "header";
      level: number;
      content: string;
    }
  | {
      kind: "codeBlock";
      content: string;
      fileType: string;
      fileName?: string;
    };

export class Markdown {
  sections: MarkdownSection[] = [];

  addHeader(level: number, content: string) {
    this.sections.push({ kind: "header", level, content });
  }

  addCodeBlock(content: string, fileType: string, fileName?: string) {
    this.sections.push({ kind: "codeBlock", content, fileType, fileName });
  }

  addMarkdown(markdown: Markdown) {
    for (const section of markdown.sections) {
      this.sections.push(section);
    }
  }

  toString(): string {
    let output = "";
    for (const section of this.sections) {
      switch (section.kind) {
        case "header":
          output += `${"#".repeat(section.level)} ${section.content}\n\n`;
          break;
        case "codeBlock": {
          const fileNamePart = section.fileName
            ? ` title="${section.fileName}"`
            : "";
          output += `\`\`\`${section.fileType}${fileNamePart}\n${section.content.trim()}\n\`\`\`\n\n`;
          break;
        }
      }
    }
    return output.trim();
  }
}
