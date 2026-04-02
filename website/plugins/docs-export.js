const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const TurndownService = require("turndown");

/**
 * Docusaurus postBuild plugin that exports rendered docs as clean Markdown.
 *
 * After Docusaurus builds HTML (with all MDX components already rendered),
 * this plugin extracts <article> content from each /docs/ page, converts
 * it back to Markdown using turndown, and writes the result to the project
 * root's docs/ directory.
 */
module.exports = function docsExportPlugin(_context, _options) {
  return {
    name: "docs-export",

    async postBuild({ routesPaths, outDir }) {
      const projectRoot = path.resolve(__dirname, "../..");
      const docsOutDir = path.join(projectRoot, "llm-docs");

      // Filter to only /docs/ routes, excluding exact "/docs" or "/docs/"
      // which is typically a redirect/index that duplicates "/docs/getting-started/"
      const docsRoutes = routesPaths.filter(
        (r) => r.startsWith("/docs/") && r !== "/docs/",
      );

      const turndown = createTurndownService();

      for (const route of docsRoutes) {
        const htmlPath = path.join(outDir, route, "index.html");
        if (!fs.existsSync(htmlPath)) {
          console.warn(
            `[docs-export] HTML not found for route ${route}: ${htmlPath}`,
          );
          continue;
        }

        const html = fs.readFileSync(htmlPath, "utf-8");
        const $ = cheerio.load(html);

        const article = $("article");
        if (article.length === 0) {
          console.warn(`[docs-export] No <article> found for route ${route}`);
          continue;
        }

        // Remove elements we don't want in the exported docs
        article.find("nav.theme-doc-breadcrumbs").remove();
        article.find("nav.pagination-nav").remove();
        article.find("a.theme-edit-this-page").remove();
        article.find("aside.theme-doc-toc-mobile, .table-of-contents").remove();
        article.find("button.clean-btn").remove();
        article.find('a[href^="/playground"]').remove();
        article.find("a.hash-link").remove();

        // For tabbed content (GratsCode mode="both"): keep both tab panels
        // but remove the tab navigation UI. Unhide hidden panels and insert
        // a label so readers know the GraphQL block is generated output.
        article.find('ul[role="tablist"]').remove();
        article.find('[role="tabpanel"][hidden]').each((_i, el) => {
          $(el).removeAttr("hidden");
          $("<p><em>Generated GraphQL schema:</em></p>").insertBefore(el);
        });

        // For custom GratsCode tab bar: remove the tab buttons and unhide
        // the hidden panel (which uses display:none in SSR).
        article.find(".grats-both__bar").remove();
        article.find('.grats-both > div[style*="display:none"]').each(
          (_i, el) => {
            $(el).removeAttr("style");
            $("<p><em>Generated GraphQL schema:</em></p>").insertBefore(el);
          },
        );

        // Replace <br> tags inside code blocks with newlines so that
        // textContent preserves line breaks (Prism uses <br> for line breaks)
        article.find("pre code br").replaceWith("\n");

        const articleHtml = article.html();
        if (!articleHtml) {
          console.warn(
            `[docs-export] Empty article content for route ${route}`,
          );
          continue;
        }

        let markdown = turndown.turndown(articleHtml);

        // Convert absolute /docs/... links to relative .md paths
        markdown = convertDocsLinks(markdown, route);

        // Build output path: /docs/getting-started/configuration -> docs/getting-started/configuration.md
        const relativePath = route.replace(/^\/docs\//, "").replace(/\/$/, "");
        const outFilePath = path.join(docsOutDir, `${relativePath}.md`);

        fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
        fs.writeFileSync(outFilePath, `${markdown}\n`, "utf-8");
      }

      console.log(
        `[docs-export] Exported ${docsRoutes.length} docs to ${docsOutDir}`,
      );
    },
  };
};

/**
 * Convert absolute /docs/... links to relative .md paths.
 *
 * e.g. from route /docs/docblock-tags/types:
 *   /docs/resolvers/renaming        -> ../resolvers/renaming.md
 *   /docs/getting-started/          -> ../getting-started.md
 *   /docs/faq/design-principles#foo -> ../faq/design-principles.md#foo
 */
function convertDocsLinks(markdown, currentRoute) {
  // Current file's directory relative to docs root
  // e.g. /docs/docblock-tags/types -> currentDir = "docblock-tags"
  const currentPath = currentRoute.replace(/^\/docs\//, "").replace(/\/$/, "");
  const currentDir = path.dirname(currentPath);

  return markdown.replace(/\]\(\/docs\/(.*?)\)/g, (_match, target) => {
    // Split off anchor
    const hashIndex = target.indexOf("#");
    const pathPart = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
    const anchor = hashIndex >= 0 ? target.slice(hashIndex) : "";

    // Strip trailing slash to normalize
    const cleanPath = pathPart.replace(/\/$/, "");
    if (!cleanPath) {
      // Link to /docs/ itself
      return `](./getting-started.md${anchor})`;
    }

    let relativePath = path.relative(currentDir, cleanPath);
    if (!relativePath.startsWith(".")) {
      relativePath = `./${relativePath}`;
    }

    return `](${relativePath}.md${anchor})`;
  });
}

function createTurndownService() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Reduce over-escaping for agent-friendly output. Turndown's default escape
  // aggressively escapes `, *, _, [, ], #, etc. which makes technical docs
  // with code references and type signatures harder to read. We only escape
  // characters that would create unwanted block-level markdown structures.
  turndown.escape = (str) => {
    return str
      .replace(/^(#{1,6}\s)/gm, "\\$1")
      .replace(/^(\s*>)/gm, "\\$1")
      .replace(/^(\s*[-*+]\s)/gm, "\\$1")
      .replace(/^(\s*\d+\.\s)/gm, "\\$1");
  };

  // Rule: fenced code blocks — extract language from class="language-xxx"
  // and strip Prism syntax-highlighting spans
  turndown.addRule("fencedCodeBlock", {
    filter: (node) =>
      node.nodeName === "PRE" &&
      node.firstChild &&
      node.firstChild.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild;
      // Language class may be on <pre> or <code> (Prism puts it on <pre>)
      const preClass = node.getAttribute("class") || "";
      const codeClass = code.getAttribute("class") || "";
      const langMatch =
        preClass.match(/language-(\S+)/) || codeClass.match(/language-(\S+)/);
      const lang = langMatch ? langMatch[1] : "";

      // Get text content, which automatically strips all HTML tags (Prism spans, etc.)
      const text = code.textContent || "";

      // Trim trailing newline that Docusaurus often adds
      const trimmed = text.replace(/\n$/, "");

      return `\n\n\`\`\`${lang}\n${trimmed}\n\`\`\`\n\n`;
    },
  });

  // Rule: inline code — preserve backtick-wrapped code
  turndown.addRule("inlineCode", {
    filter: (node) =>
      node.nodeName === "CODE" &&
      node.parentNode &&
      node.parentNode.nodeName !== "PRE",
    replacement: (content) => {
      if (!content) return "";
      if (content.includes("`")) {
        return `\`\` ${content} \`\``;
      }
      return `\`${content}\``;
    },
  });

  // Rule: Docusaurus admonitions (note, tip, warning, etc.)
  // These render as <div class="theme-admonition theme-admonition-note ...">
  turndown.addRule("admonition", {
    filter: (node) =>
      node.nodeName === "DIV" &&
      (node.getAttribute("class") || "").includes("theme-admonition"),
    replacement: (content, node) => {
      const classAttr = node.getAttribute("class") || "";
      const typeMatch = classAttr.match(/theme-admonition-(\w+)/);
      const type = typeMatch ? typeMatch[1].toUpperCase() : "NOTE";

      // Prefix every line with > to keep multi-line admonitions inside the blockquote
      const trimmed = content.trim();
      const quoted = trimmed
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `\n\n> **${type}:**\n${quoted}\n\n`;
    },
  });

  // Rule: strip admonition icon SVGs and titles (fold into the admonition rule above)
  turndown.addRule("admonitionIcon", {
    filter: (node) =>
      node.nodeName === "DIV" &&
      (node.getAttribute("class") || "").includes("admonitionHeading"),
    replacement: () => "",
  });

  // Rule: Docusaurus details/summary (collapsible sections)
  turndown.addRule("details", {
    filter: "details",
    replacement: (content, node) => {
      const summary = node.querySelector("summary");
      const summaryText = summary ? summary.textContent.trim() : "Details";
      const body = content.replace(summaryText, "").trim();
      return `\n\n**${summaryText}**\n\n${body}\n\n`;
    },
  });

  // Strip SVG elements entirely
  turndown.addRule("svg", {
    filter: "svg",
    replacement: () => "",
  });

  return turndown;
}
