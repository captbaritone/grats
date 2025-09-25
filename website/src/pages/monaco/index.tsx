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

    // Register custom diagnostics provider for TODO detection
    monaco.languages.registerCodeActionProvider("typescript", {
      provideCodeActions: (model, range, context) => {
        const actions: any[] = [];

        // Check if any of the markers in the context are TODO errors
        const todoMarkers = context.markers.filter(
          (marker) => marker.code === "todo-error",
        );

        todoMarkers.forEach((marker) => {
          const text = model.getValueInRange({
            startLineNumber: marker.startLineNumber,
            startColumn: marker.startColumn,
            endLineNumber: marker.endLineNumber,
            endColumn: marker.endColumn,
          });

          if (text.toUpperCase() === "TODO") {
            actions.push({
              title: "Convert TODO to lowercase",
              id: "convert-todo-lowercase",
              kind: "quickfix",
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: {
                        startLineNumber: marker.startLineNumber,
                        startColumn: marker.startColumn,
                        endLineNumber: marker.endLineNumber,
                        endColumn: marker.endColumn,
                      },
                      text: text.toLowerCase(),
                    },
                  },
                ],
              },
            });
          }
        });

        return {
          actions,
          dispose: () => {},
        };
      },
    });

    // Custom diagnostics provider for TODO detection
    function validateTodos(model) {
      const markers: any[] = [];
      const text = model.getValue();
      const lines = text.split("\n");

      lines.forEach((line, lineNumber) => {
        const todoMatch = line.match(/TODO/gi);
        if (todoMatch) {
          todoMatch.forEach((match) => {
            const startColumn = line.indexOf(match) + 1;
            const endColumn = startColumn + match.length;

            markers.push({
              severity: monaco.MarkerSeverity.Error,
              startLineNumber: lineNumber + 1,
              startColumn: startColumn,
              endLineNumber: lineNumber + 1,
              endColumn: endColumn,
              message: "TODO found: Please complete this task",
              code: "todo-error",
            });
          });
        }
      });

      monaco.editor.setModelMarkers(model, "todo-diagnostics", markers);
    }

    // Hook into model creation to add TODO validation
    const originalCreateModel = monaco.editor.createModel;
    monaco.editor.createModel = function (...args) {
      const model = originalCreateModel.apply(this, args);

      // Validate TODOs initially
      validateTodos(model);

      // Validate TODOs on content change
      model.onDidChangeContent(() => {
        validateTodos(model);
      });

      return model;
    };

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
            // height={500}
            editorWillMount={onEditorWillMount}
            theme={isDarkTheme ? "vs-dark" : "vs-light"}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
          <MonacoEditor
            {...props}
            value={SCHEMA}
            language="graphql"
            // height={500}
            editorWillMount={onEditorWillMount}
            theme={isDarkTheme ? "vs-dark" : "vs-light"}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              readOnly: true,
            }}
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
