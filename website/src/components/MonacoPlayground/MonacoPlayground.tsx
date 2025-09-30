// Based on https://github.com/facebook/hermes/pull/173/files
import React, { useEffect, useRef, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";
import MonacoEditor, { MonacoEditorHandle } from "react-monaco-editor";
import monaco from "monaco-editor";
import ConfigBar from "./ConfigBar";
import { ViewMode } from "./types";
import { Right } from "./Right";
import { SANDBOX } from "./Sandbox";

/**
 * # TODO
 * - [ ] Copy URL
 * - [ ] Persist state in URL
 * - [ ] Executable schema
 * - [ ] Code action icons
 */

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

  const [viewMode, setViewMode] = useState<ViewMode>("sdl");
  const [nullableByDefault, setNullableByDefault] = useState(true);

  return (
    <FillRemainingHeight minHeight={300}>
      <ConfigBar
        viewMode={viewMode}
        setViewMode={setViewMode}
        nullableByDefault={nullableByDefault}
        setNullableByDefault={(nullableByDefault) => {
          SANDBOX.setGratsConfig({ nullableByDefault });
          setNullableByDefault(nullableByDefault);
        }}
      />
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
              SANDBOX.setTsEditor(editor);
              setEditor(editor);
            }}
            value={SANDBOX.getSerializableState().doc}
            language="typescript"
            theme={theme}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
          <Right viewMode={viewMode} />
        </div>
      </div>
    </FillRemainingHeight>
  );
}

export default MonacoEditorComponent;
