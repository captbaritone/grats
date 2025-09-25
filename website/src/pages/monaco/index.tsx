// Based on https://github.com/facebook/hermes/pull/173/files
import React from "react";
const BrowserOnly = require("@docusaurus/BrowserOnly").default;

const CONTENT = `/** @gqlQueryField */
export function me(): User {
  return new User();
}

/**
 * A user in our kick-ass system!
 * @gqlType
 */
class User {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(salutation: string): string {
    return \`\${salutation}, \${this.name}\`;
  }
}`;

const SCHEMA = `type Query {
  me: User
  viewer: User @deprecated(reason: "Please use \`me\` instead.")
}

"""A user in our kick-ass system!"""
type User {
  greeting(salutation: String!): String
  name: String
}`;

function MonacoEditorComponent(props) {
  // Import Monaco Editor dynamically to avoid SSR issues
  const MonacoEditor = require("react-monaco-editor").default;
  
  // const { isDarkTheme } = useThemeContext();
  const isDarkTheme = true;

  function onEditorWillMount(monaco) {
    const vsDarkTheme = {
      base: "vs-dark",
      inherit: true,
      rules: [{ background: "121212" }],
      colors: {
        "editor.background": "#121212",
      },
    };

    monaco.editor.defineTheme("vs-dark", vsDarkTheme);

    if (props.editorWillMount) {
      props.editorWillMount(monaco);
    }
  }

  return (
    <div>
      <h2>TypeScript Code</h2>
      <MonacoEditor
        {...props}
        value={CONTENT}
        language="typescript"
        height={500}
        editorWillMount={onEditorWillMount}
        theme={isDarkTheme ? "vs-dark" : "vs-light"}
      />
      <h2>Generated GraphQL Schema</h2>
      <MonacoEditor
        {...props}
        value={SCHEMA}
        language="graphql"
        height={500}
        editorWillMount={onEditorWillMount}
        theme={isDarkTheme ? "vs-dark" : "vs-light"}
      />
    </div>
  );
}

function Editor(props) {
  return (
    <BrowserOnly fallback={<div>Loading Monaco Editor...</div>}>
      {() => <MonacoEditorComponent {...props} />}
    </BrowserOnly>
  );
}

export default Editor;
