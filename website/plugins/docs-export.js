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
      const docsOutDir = path.join(projectRoot, "docs");

      // Filter to only /docs/ routes, excluding exact "/docs" or "/docs/"
      // which is typically a redirect/index that duplicates "/docs/getting-started/"
      const docsRoutes = routesPaths.filter(
        (r) => r.startsWith("/docs/") && r !== "/docs/"
      );

      const turndown = createTurndownService();

      for (const route of docsRoutes) {
        const htmlPath = path.join(outDir, route, "index.html");
        if (!fs.existsSync(htmlPath)) {
          console.warn(`[docs-export] HTML not found for route ${route}: ${htmlPath}`);
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
        // Breadcrumbs
        article.find("nav.theme-doc-breadcrumbs").remove();
        // Pagination (prev/next links)
        article.find("nav.pagination-nav").remove();
        // "Edit this page" links
        article.find("a.theme-edit-this-page").remove();
        // Table of contents (inline)
        article.find("aside.theme-doc-toc-mobile, .table-of-contents").remove();
        // Theme toggler / copy buttons inside code blocks
        article.find("button.clean-btn").remove();
        // Playground links (absolute-positioned links inside code blocks)
        article.find('a[href^="/playground"]').remove();

        // Remove hidden tab panels (inactive tabs from GratsCode mode="both")
        article.find('[role="tabpanel"][hidden]').remove();
        // Remove tab navigation (the tab buttons themselves)
        article.find('ul[role="tablist"]').remove();

        // Strip the hash-link anchors that Docusaurus adds to headings
        article.find("a.hash-link").remove();

        // Replace <br> tags inside code blocks with newlines so that
        // textContent preserves line breaks (Prism uses <br> for line breaks)
        article.find("pre code br").replaceWith("\n");

        const articleHtml = article.html();
        if (!articleHtml) {
          console.warn(`[docs-export] Empty article content for route ${route}`);
          continue;
        }

        const markdown = turndown.turndown(articleHtml);

        // Build output path: /docs/getting-started/configuration -> docs/getting-started/configuration.md
        const relativePath = route.replace(/^\/docs\//, "").replace(/\/$/, "");
        const outFilePath = path.join(docsOutDir, relativePath + ".md");

        fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
        fs.writeFileSync(outFilePath, markdown + "\n", "utf-8");
      }

      console.log(`[docs-export] Exported ${docsRoutes.length} docs to ${docsOutDir}`);
    },
  };
};

function createTurndownService() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Rule: fenced code blocks — extract language from class="language-xxx"
  // and strip Prism syntax-highlighting spans
  turndown.addRule("fencedCodeBlock", {
    filter(node) {
      return (
        node.nodeName === "PRE" &&
        node.firstChild &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content, node) {
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
    filter(node) {
      return (
        node.nodeName === "CODE" &&
        node.parentNode &&
        node.parentNode.nodeName !== "PRE"
      );
    },
    replacement(content) {
      if (!content) return "";
      // If content contains backticks, use double backticks
      if (content.includes("`")) {
        return "`` " + content + " ``";
      }
      return "`" + content + "`";
    },
  });

  // Rule: Docusaurus admonitions (note, tip, warning, etc.)
  // These render as <div class="theme-admonition theme-admonition-note ...">
  turndown.addRule("admonition", {
    filter(node) {
      return (
        node.nodeName === "DIV" &&
        (node.getAttribute("class") || "").includes("theme-admonition")
      );
    },
    replacement(content, node) {
      const classAttr = node.getAttribute("class") || "";
      const typeMatch = classAttr.match(/theme-admonition-(\w+)/);
      const type = typeMatch ? typeMatch[1].toUpperCase() : "NOTE";

      // The content includes the admonition title (first child) + body
      const trimmed = content.trim();
      return `\n\n> **${type}:** ${trimmed}\n\n`;
    },
  });

  // Rule: strip admonition icon SVGs and titles (fold into the admonition rule above)
  turndown.addRule("admonitionIcon", {
    filter(node) {
      // Remove the admonition heading/icon container
      return (
        node.nodeName === "DIV" &&
        (node.getAttribute("class") || "").includes("admonitionHeading")
      );
    },
    replacement() {
      return "";
    },
  });

  // Rule: Docusaurus details/summary (collapsible sections)
  turndown.addRule("details", {
    filter: "details",
    replacement(content, node) {
      const summary = node.querySelector("summary");
      const summaryText = summary ? summary.textContent.trim() : "Details";
      // Remove the summary text from content since we're using it as a header
      const body = content.replace(summaryText, "").trim();
      return `\n\n**${summaryText}**\n\n${body}\n\n`;
    },
  });

  // Strip SVG elements entirely
  turndown.addRule("svg", {
    filter: "svg",
    replacement() {
      return "";
    },
  });

  return turndown;
}
