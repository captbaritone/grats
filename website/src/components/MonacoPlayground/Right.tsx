import React, { useEffect, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import MonacoEditor from "react-monaco-editor";
import monaco, { IDisposable } from "monaco-editor";
import { ViewMode } from "./types";
import { TypeScriptWorker } from "@site/src/workerTypes";

export function Right({
  editor,
  worker,
  viewMode,
  configVersion,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  viewMode: ViewMode;
  configVersion: number;
}) {
  switch (viewMode) {
    case "ts":
      return (
        <TsSchema
          editor={editor}
          worker={worker}
          configVersion={configVersion}
        />
      );
    case "sdl":
      return (
        <GraphQLSchema
          editor={editor}
          worker={worker}
          configVersion={configVersion}
        />
      );
    case "metadata":
      return (
        <Metadata
          editor={editor}
          worker={worker}
          configVersion={configVersion}
        />
      );
    default:
      throw new Error("Ooops");
  }
}

function GraphQLSchema({
  editor,
  worker,
  configVersion,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  configVersion: number;
}) {
  const gql = useWorkerValue(editor, worker, configVersion, async (worker) => {
    return worker.getGraphQLSchema();
  });
  return <Editor value={gql} language="graphql" readOnly />;
}

function Metadata({
  editor,
  worker,
  configVersion,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  configVersion: number;
}) {
  const json = useWorkerValue(editor, worker, configVersion, async (worker) => {
    return worker.getResolverSignatures();
  });
  return <Editor value={json} language="json" readOnly />;
}

function TsSchema({
  editor,
  worker,
  configVersion,
}: {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  worker: TypeScriptWorker;
  configVersion: number;
}) {
  const ts = useWorkerValue(editor, worker, configVersion, async (worker) => {
    return worker.getTsSchema();
  });
  return <Editor value={ts} language="typescript" readOnly />;
}

type EditorProps = {
  value: string | null;
  readOnly?: boolean;
  language: "typescript" | "graphql" | "json";
};

function Editor({ value, readOnly, language }: EditorProps) {
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";
  return (
    <MonacoEditor
      value={value || "Loading..."}
      language={language}
      theme={theme}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: readOnly ?? false,
      }}
    />
  );
}

function useWorkerValue<T>(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  worker: TypeScriptWorker,
  configVersion: number,
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

    async function setSchema(worker: TypeScriptWorker) {
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
  }, [editor, worker, configVersion]);
  return tsSchema;
}
