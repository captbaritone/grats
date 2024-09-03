import React from "react";
import { getOutputOption, useAppSelector } from "../PlaygroundFeatures/store";
import {
  getErrorText,
  getSchemaText,
  getTsSchema,
} from "../PlaygroundFeatures/gratsStoreBindings";
import MonacoEditor from "../MonacoPlayground/MonacoEditor";

/**
 * If there are errors, show the error message as plain text.
 *
 * If the output option is "sdl", show the SDL.
 * If the output option is "typescript", show the generated graphql-js implementation.
 */
export default function OutputEditor() {
  const errorText = useAppSelector(getErrorText);
  const outputOptions = useAppSelector(getOutputOption);
  if (errorText) {
    return <ErrorsEditor errorText={errorText} />;
  }
  switch (outputOptions) {
    case "sdl":
      return <SchemaEditor />;
    case "typescript":
      return <TsSchemaEditor />;
    default:
      return null;
  }
}

function ErrorsEditor({ errorText }) {
  return (
    <MonacoEditor
      value={errorText}
      options={{ readOnly: true, wordWrap: "on" }}
      language="plaintext"
    />
  );
}

function TsSchemaEditor() {
  const tsSchema = useAppSelector(getTsSchema);
  return (
    <MonacoEditor
      value={tsSchema ?? ""}
      options={{ readOnly: true }}
      language="typescript"
    />
  );
}

function SchemaEditor() {
  const schemaText = useAppSelector(getSchemaText);
  return (
    <MonacoEditor
      value={schemaText ?? ""}
      options={{ readOnly: true }}
      language="graphql"
    />
  );
}
