// Based on https://github.com/facebook/hermes/pull/173/files
import React from "react";
import MonacoEditor from "react-monaco-editor";
import metadata from "monaco-editor/esm/metadata";
console.log(metadata.languages);
// import useThemeContext from "@theme/hooks/useThemeContext";

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

function Editor(props) {
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
      <MonacoEditor
        {...props}
        value={CONTENT}
        language="javascript"
        height={500}
        editorWillMount={onEditorWillMount}
        theme={isDarkTheme ? "vs-dark" : "vs-light"}
      />
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

export default Editor;
