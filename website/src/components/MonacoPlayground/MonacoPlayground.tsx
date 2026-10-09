// Based on https://github.com/facebook/hermes/pull/173/files
import React, { useRef, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";
import ConfigBar from "./ConfigBar";
import { OutputOption, PlaygroundMode } from "./State";
import { Right, RightRef } from "./Right";
import { SANDBOX } from "./Sandbox";
import { ResizablePanels } from "./ResizablePanels";
import { Editor, EditorRef } from "./Editor";
import { ExecutePanel } from "./ExecutePanel";

// Matches the default code in `Sandbox.ts`.
const DEFAULT_QUERY = `query {
  me {
    name
    greeting(salutation: "Hello")
  }
}
`;

function MonacoEditorComponent() {
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";

  const leftEditorRef = useRef<EditorRef>(null);
  const rightEditorRef = useRef<RightRef>(null);

  const [mode, setMode] = useState<PlaygroundMode>("code");
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [viewMode, setViewMode] = useState<OutputOption>(
    SANDBOX.getOutputOption(),
  );

  // Get initial config from SANDBOX
  const initialConfig = SANDBOX.getSerializableState().config;
  const [config, setConfig] = useState(initialConfig);

  const handleConfigChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    SANDBOX.setGratsConfig({ [key]: value });
  };

  return (
    <FillRemainingHeight minHeight={300}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          height: "100%",
        }}
      >
        <ConfigBar
          mode={mode}
          setMode={setMode}
          viewMode={viewMode}
          setViewMode={(newViewMode) => {
            setViewMode(newViewMode);
            SANDBOX.setOutputOption(newViewMode);
          }}
          config={config}
          onConfigChange={handleConfigChange}
        />
        {mode === "execute" && (
          <ExecutePanel query={query} onQueryChange={setQuery} />
        )}
        {/* Kept mounted, since `SANDBOX` holds on to the editor. */}
        <div
          style={{
            display: mode === "code" ? "flex" : "none",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <ResizablePanels
            leftPanel={
              <Editor
                ref={leftEditorRef}
                value={SANDBOX.getSerializableState().doc}
                language="typescript"
                theme={theme}
                onEditorDidMount={(editor) => {
                  SANDBOX.setTsEditor(editor);
                }}
              />
            }
            rightPanel={<Right ref={rightEditorRef} viewMode={viewMode} />}
          />
        </div>
      </div>
    </FillRemainingHeight>
  );
}

export default MonacoEditorComponent;
