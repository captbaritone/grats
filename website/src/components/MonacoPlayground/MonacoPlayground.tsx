// Based on https://github.com/facebook/hermes/pull/173/files
import React, { useRef, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";
import ConfigBar from "./ConfigBar";
import { OutputOption } from "../PlaygroundFeatures/store";
import { Right, RightRef } from "./Right";
import { SANDBOX } from "./Sandbox";
import { ResizablePanels } from "./ResizablePanels";
import { Editor, EditorRef } from "./Editor";

/**
 * # TODO
 * - [ ] Executable schema
 * - [ ] Show error text in the right panel if the schema generation fails
 */

function MonacoEditorComponent() {
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";

  const leftEditorRef = useRef<EditorRef>(null);
  const rightEditorRef = useRef<RightRef>(null);

  const handleResize = () => {
    // Trigger editor layout when panels are resized
    setTimeout(() => {
      if (leftEditorRef.current) {
        leftEditorRef.current.layout();
      }
      if (rightEditorRef.current) {
        rightEditorRef.current.layout();
      }
    }, 0);
  };

  const [viewMode, setViewMode] = useState<OutputOption>("sdl");
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
          onResize={handleResize}
        />
      </div>
    </FillRemainingHeight>
  );
}

export default MonacoEditorComponent;
