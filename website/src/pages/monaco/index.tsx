// Based on https://github.com/facebook/hermes/pull/173/files
import React from "react";
import { useColorMode } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";

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
  const { colorMode } = useColorMode();
  const isDarkTheme = colorMode !== "light";

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
    <FillRemainingHeight minHeight={300}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* <ConfigBar /> */}
        <div
          style={{
            flexGrow: 1,
            position: "relative",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "row",
            overflow: "scroll",
          }}
        >
          <MonacoEditor
            {...props}
            value={CONTENT}
            language="typescript"
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
      </div>
    </FillRemainingHeight>
  );
}

function Editor(props) {
  return (
    <Layout title={`Playground`} noFooter>
      <BrowserOnly fallback={<div>Loading Monaco Editor...</div>}>
        {() => <MonacoEditorComponent {...props} />}
      </BrowserOnly>
    </Layout>
  );
}

export default Editor;
