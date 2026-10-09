import React, { useCallback, useEffect, useRef, useState } from "react";
import monaco from "monaco-editor";
import { useColorMode } from "@docusaurus/theme-common";
import { SANDBOX } from "./Sandbox";
import { Editor } from "./Editor";
import { ResizablePanels } from "./ResizablePanels";
import { LoadingFallback } from "./LoadingFallback";
import { execute, setModules } from "./executor";

type SchemaState =
  | { kind: "LOADING" }
  | { kind: "READY" }
  | { kind: "ERROR"; message: string };

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
};

/**
 * Executes queries against the schema defined by the code in the editor. Each
 * time it's shown, or the config changes, the code and the executable schema
 * Grats generates for it are loaded into the playground's service worker.
 */
export function ExecutePanel({ query, onQueryChange }: Props) {
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";
  const [schema, setSchema] = useState<SchemaState>({ kind: "LOADING" });
  const [result, setResult] = useState<string | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  const run = useCallback(async () => {
    try {
      const response = await execute({ query: queryRef.current });
      setResult(JSON.stringify(response, null, 2));
    } catch (e) {
      setResult(`// ${errorMessage(e)}`);
    }
  }, []);

  useEffect(() => {
    let unmounted = false;
    async function load() {
      setSchema({ kind: "LOADING" });
      try {
        const worker = await SANDBOX.getWorker();
        const modules = await worker.getExecutableModules();
        if (modules.kind === "ERROR") {
          throw new Error(
            `Fix the errors Grats reported in the code:\n\n${modules.message}`,
          );
        }
        await setModules(modules.modules);
        if (unmounted) return;
        setSchema({ kind: "READY" });
        run();
      } catch (e) {
        if (unmounted) return;
        setSchema({ kind: "ERROR", message: errorMessage(e) });
      }
    }
    const disposable = SANDBOX.onTSDidChange(load);
    load();
    return () => {
      unmounted = true;
      disposable.dispose();
    };
  }, [run]);

  // Monaco keeps the first command it's given, so use a ref to run the latest.
  const runRef = useRef(run);
  runRef.current = run;
  const ready = schema.kind === "READY";
  const readyRef = useRef(ready);
  readyRef.current = ready;

  return (
    <ResizablePanels
      leftPanel={
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5em",
              padding: "0 1rem 10px",
              fontSize: "0.8rem",
            }}
          >
            <button onClick={run} disabled={!ready}>
              ▶ Run
            </button>
            <span style={{ color: "#666" }}>
              {schema.kind === "LOADING"
                ? "Loading schema…"
                : "⌘/Ctrl + Enter to run"}
            </span>
          </div>
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <Editor
              value={query}
              onChange={onQueryChange}
              language="graphql"
              theme={theme}
              onEditorDidMount={(editor) => {
                editor.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                  () => {
                    if (readyRef.current) runRef.current();
                  },
                );
              }}
            />
          </div>
        </div>
      }
      rightPanel={
        schema.kind === "ERROR" ? (
          <pre
            style={{
              height: "100%",
              margin: 0,
              borderRadius: 0,
              color: "var(--ifm-color-danger)",
              whiteSpace: "pre-wrap",
            }}
          >
            {schema.message}
          </pre>
        ) : result == null ? (
          <LoadingFallback />
        ) : (
          <Editor value={result} language="json" theme={theme} readOnly />
        )
      }
    />
  );
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
