// Based on https://github.com/facebook/hermes/pull/173/files
import React, { useEffect, useRef, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";
import MonacoEditor, { MonacoEditorHandle } from "react-monaco-editor";
import monaco, { IDisposable } from "monaco-editor";

// See https://github.com/microsoft/monaco-editor/pull/3488
window.MonacoEnvironment = {
  getWorker(workerId, label) {
    switch (label) {
      case "editorWorkerService": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/editor/editor.worker.js",
            import.meta.url,
          ),
        );
      }

      case "json": {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker.js",
            import.meta.url,
          ),
        );
      }

      case "javascript":
      case "typescript": {
        return new Worker(
          new URL("../../workers/grats.worker.ts", import.meta.url),
        );
      }

      default: {
        throw new Error(`Unsupported worker label: ${label}`);
      }
    }
  },
};

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

function MonacoEditorComponent() {
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";

  const monacoEditorRef = useRef<MonacoEditorHandle>(null);

  const [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

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
            ref={monacoEditorRef}
            editorDidMount={(editor) => {
              setEditor(editor);
            }}
            value={CONTENT}
            language="typescript"
            theme={theme}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
          <Right editor={editor} />
        </div>
      </div>
    </FillRemainingHeight>
  );
}

function Right({ editor }) {
  const [tab, setTab] = useState("ts");
  let content;
  switch (tab) {
    case "ts":
      content = <TsSchema editor={editor} />;
      break;
    case "graphql":
      content = <GraphQLSchema editor={editor} />;
      break;
    default:
      throw new Error("Ooops");
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 10, padding: 10 }}>
        <a
          style={{
            fontWeight: tab === "graphql" ? "bold" : "normal",
          }}
          onClick={() => {
            setTab("graphql");
          }}
        >
          GraphQL Schema
        </a>
        <a
          style={{
            fontWeight: tab === "ts" ? "bold" : "normal",
          }}
          onClick={() => {
            setTab("ts");
          }}
        >
          TS Schema
        </a>
      </div>
      {content}
    </div>
  );
}

function GraphQLSchema({
  editor,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
}) {
  const ts = useWorkerValue(editor, async (worker) => {
    return worker.getGraphQLSchema();
  });
  return (
    <MonacoEditor
      value={ts || "Loading..."}
      language="graphql"
      // theme={theme}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: true,
      }}
    />
  );
}

function TsSchema({
  editor,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
}) {
  const ts = useWorkerValue(editor, async (worker) => {
    return worker.getTsSchema();
  });
  return (
    <MonacoEditor
      value={ts || "Loading..."}
      language="typescript"
      // theme={theme}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: true,
      }}
    />
  );
}

function useWorkerValue<T>(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  fn: (worker: any) => Promise<T>,
): T | null {
  const [tsSchema, setTs] = useState<T | null>(null);
  useEffect(() => {
    if (editor == null) {
      return;
    }

    let unmounted = false;
    async function setSchema(worker) {
      const value = await fn(worker);
      if (unmounted) {
        return;
      }
      setTs(value);
    }

    let disposable: IDisposable | null = null;
    monaco.languages.typescript
      .getTypeScriptWorker()
      .then(async (getWorker) => {
        if (unmounted) {
          return;
        }
        const model = editor.getModel();
        if (model == null) {
          throw new Error("Expected to find model");
        }
        const worker = await getWorker();
        if (unmounted) {
          return;
        }
        setSchema(worker);
        disposable = editor.onDidChangeModelContent(() => {
          setSchema(worker);
        });
      });
    return () => {
      unmounted = true;
      if (disposable) {
        disposable.dispose();
      }
    };
  }, [editor]);
  return tsSchema;
}

export default MonacoEditorComponent;
