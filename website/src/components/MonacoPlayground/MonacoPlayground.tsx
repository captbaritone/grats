// Based on https://github.com/facebook/hermes/pull/173/files
import React, { useEffect, useRef, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";
import MonacoEditor, { MonacoEditorHandle } from "react-monaco-editor";
import monaco, { IDisposable } from "monaco-editor";
import ConfigBar from "./ConfigBar";
import { ViewMode } from "./types";
import { TypeScriptWorker } from "@site/src/workerTypes";

/**
 * # TODO
 * - [ ] Copy URL
 * - [ ] Persist state in URL
 * - [ ] Format button
 * - [ ] Config options (nullable by default, etc)
 * - [ ] Metadata view
 * - [ ] Executable schema
 */

// monaco.languages.typescript.typescriptDefaults.setCompilerOptions({});

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

function MonacoEditorComponent() {
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";

  const monacoEditorRef = useRef<MonacoEditorHandle>(null);

  const [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editor == null) {
      return;
    }
    function handler() {
      editor!.layout();
    }

    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
    };
  });

  const worker = useWorker(editor);

  const [viewMode, setViewMode] = useState<ViewMode>("sdl");

  return (
    <FillRemainingHeight minHeight={300}>
      <ConfigBar viewMode={viewMode} setViewMode={setViewMode} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
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
          <Right
            editor={editor}
            viewMode={viewMode}
            worker={worker}
            theme={theme}
          />
        </div>
      </div>
    </FillRemainingHeight>
  );
}

function Right({
  editor,
  worker,
  viewMode,
  theme,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  viewMode: ViewMode;
  theme: string;
}) {
  switch (viewMode) {
    case "ts":
      return <TsSchema editor={editor} worker={worker} theme={theme} />;
    case "sdl":
      return <GraphQLSchema editor={editor} worker={worker} theme={theme} />;
    case "metadata":
      return <Metadata editor={editor} worker={worker} theme={theme} />;
    default:
      throw new Error("Ooops");
  }
}

function GraphQLSchema({
  editor,
  worker,
  theme,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  theme: string;
}) {
  const gql = useWorkerValue(editor, worker, async (worker) => {
    return worker.getGraphQLSchema();
  });
  return (
    <MonacoEditor
      value={gql || "Loading..."}
      language="graphql"
      theme={theme}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: true,
      }}
    />
  );
}

function Metadata({
  editor,
  worker,
  theme,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  theme: string;
}) {
  const json = useWorkerValue(editor, worker, async (worker) => {
    return worker.getResolverSignatures();
  });
  return (
    <MonacoEditor
      value={json || "Loading..."}
      language="json"
      theme={theme}
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
  worker,
  theme,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  theme: string;
}) {
  const ts = useWorkerValue(editor, worker, async (worker) => {
    return worker.getTsSchema();
  });
  return (
    <MonacoEditor
      value={ts || "Loading..."}
      language="typescript"
      theme={theme}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: true,
      }}
    />
  );
}

function useWorker(editor: monaco.editor.IStandaloneCodeEditor | null) {
  const [worker, setWorker] = useState<any | null>(null);
  useEffect(() => {
    if (editor == null) {
      // There is no worker until there is an editor I think
      return;
    }
    let unmounted = false;
    monaco.languages.typescript
      .getTypeScriptWorker()
      .then(async (getWorker) => {
        if (unmounted) {
          return;
        }
        const worker = await getWorker();
        if (unmounted) {
          return;
        }
        setWorker(worker);
      });
    return () => {
      unmounted = true;
    };
  }, [editor]);
  return worker;
}

function useWorkerValue<T>(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  worker: TypeScriptWorker,
  fn: (worker: any) => Promise<T>,
): T | null {
  const [tsSchema, setTs] = useState<T | null>(null);
  useEffect(() => {
    if (editor == null) {
      return;
    }
    if (worker == null) {
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
    setSchema(worker);
    disposable = editor.onDidChangeModelContent(() => {
      setSchema(worker);
    });
    return () => {
      unmounted = true;
      if (disposable) {
        disposable.dispose();
      }
    };
  }, [editor, worker]);
  return tsSchema;
}

export default MonacoEditorComponent;
