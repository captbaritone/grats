// Based on https://github.com/facebook/hermes/pull/173/files
import React, { useEffect, useRef, useState } from "react";
import monaco from "monaco-editor";
import clsx from "clsx";
import FillRemainingHeight from "@site/src/components/FillRemainingHeight";
import SwitchSideButton from "./SwitchSideButton";
import FormatButton from "./FormatButton";
import ShareButton from "./ShareButton";
import VersionLink from "./VersionLink";
import FileTabs, { FileTab } from "./FileTabs";
import { OutputOption, Side } from "./State";
import { Right, getOutputTabs } from "./Right";
import { SANDBOX, TSCONFIG_URI } from "./Sandbox";
import { JsonFileIcon, TypeScriptFileIcon } from "./icons";
import { ResizablePanels } from "./ResizablePanels";
import { Editor } from "./Editor";
import { ExecutePanel } from "./ExecutePanel";
import styles from "./playground.module.css";

type SourceFile = "index.ts" | "tsconfig.json";

const SOURCE_FILES: FileTab<SourceFile>[] = [
  {
    id: "index.ts",
    name: "index.ts",
    icon: <TypeScriptFileIcon />,
    description: "The code Grats extracts a schema from.",
  },
  {
    id: "tsconfig.json",
    name: "tsconfig.json",
    icon: <JsonFileIcon />,
    description: "Grats' options, under the `grats` key.",
  },
];

// How long after the playground comes to rest GraphiQL loads.
const CLIENT_PRELOAD_DELAY_MS = 1000;

/**
 * The playground has two sides: the server, where you write the code Grats
 * builds a schema from, and the client, where you query that schema with
 * GraphiQL. Switching sides flips the playground around.
 */
function MonacoEditorComponent() {
  const [side, setSide] = useState<Side>("server");
  const [flipping, setFlipping] = useState(false);

  const switchSide = (next: Side) => {
    if (next === side) return;
    setSide(next);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlipping(true);
    }
  };

  // GraphiQL loads in the background, shortly after the card comes to rest,
  // and stays loaded, so there's always a ready GraphiQL to flip to. It
  // doesn't mount mid-flip: Monaco caches where its text is on screen as it
  // first renders, and while the card is turned that breaks mouse selection.
  const [clientMounted, setClientMounted] = useState(false);
  useEffect(() => {
    if (clientMounted || flipping) return;
    const timeout = setTimeout(
      () => setClientMounted(true),
      side === "client" ? 0 : CLIENT_PRELOAD_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [clientMounted, flipping, side]);

  const [sourceFile, setSourceFile] = useState<SourceFile>("index.ts");
  const editors = useRef<
    Partial<Record<SourceFile, monaco.editor.IStandaloneCodeEditor>>
  >({});
  // The tsconfig.json editor is given its initial text, and then owns it.
  const [initialTsconfig] = useState(() => SANDBOX.getTsconfigText());

  // The config names the output files.
  const [config, setConfig] = useState(() => SANDBOX.getConfig());
  useEffect(() => {
    const disposable = SANDBOX.onTSDidChange(() =>
      setConfig(SANDBOX.getConfig()),
    );
    return () => disposable.dispose();
  }, []);

  const [output, setOutput] = useState<OutputOption>(SANDBOX.getOutputOption());

  // At rest, only the current side is visible. While flipping, both are.
  const isHidden = (face: Side) => !flipping && side !== face;

  return (
    <FillRemainingHeight minHeight={300}>
      <div className={styles.playground}>
        <div className={styles.stage}>
          <div
            className={clsx(
              styles.card,
              flipping && styles.flipping,
              flipping && side === "server" && styles.flipToServer,
            )}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) {
                setFlipping(false);
              }
            }}
          >
            {/* Kept mounted, since `SANDBOX` holds on to the editor. */}
            <div
              className={clsx(
                styles.face,
                styles.faceServer,
                isHidden("server") && styles.faceHidden,
              )}
            >
              <ResizablePanels
                leftPanel={
                  <Pane
                    tabs={
                      <FileTabs<SourceFile>
                        tabs={SOURCE_FILES}
                        active={sourceFile}
                        onSelect={setSourceFile}
                        actions={
                          <>
                            <FormatButton
                              getEditor={() => editors.current[sourceFile]}
                            />
                            <span className={styles.separator} />
                            <ShareButton />
                            <span className={styles.separator} />
                            <VersionLink />
                          </>
                        }
                      />
                    }
                  >
                    <div
                      className={styles.file}
                      hidden={sourceFile !== "index.ts"}
                    >
                      <Editor
                        value={SANDBOX.getSerializableState().doc}
                        language="typescript"
                        onEditorDidMount={(editor) => {
                          editors.current["index.ts"] = editor;
                          SANDBOX.setTsEditor(editor);
                        }}
                      />
                    </div>
                    <div
                      className={styles.file}
                      hidden={sourceFile !== "tsconfig.json"}
                    >
                      <Editor
                        value={initialTsconfig}
                        language="json"
                        uri={TSCONFIG_URI}
                        onChange={(text) => SANDBOX.setTsconfigText(text)}
                        onEditorDidMount={(editor) => {
                          editors.current["tsconfig.json"] = editor;
                        }}
                      />
                    </div>
                  </Pane>
                }
                rightPanel={
                  <Pane
                    tabs={
                      <FileTabs<OutputOption>
                        tabs={getOutputTabs(config)}
                        active={output}
                        onSelect={(newOutput) => {
                          setOutput(newOutput);
                          SANDBOX.setOutputOption(newOutput);
                        }}
                      />
                    }
                  >
                    <Right output={output} />
                  </Pane>
                }
              />
            </div>
            <div
              className={clsx(
                styles.face,
                styles.faceClient,
                isHidden("client") && styles.faceHidden,
              )}
            >
              {clientMounted && <ExecutePanel />}
            </div>
            <div className={clsx(styles.cardEdge, styles.cardEdgeLeft)} />
            <div className={clsx(styles.cardEdge, styles.cardEdgeRight)} />
            <div className={clsx(styles.cardEdge, styles.cardEdgeTop)} />
            <div className={clsx(styles.cardEdge, styles.cardEdgeBottom)} />
          </div>
          {/* Outside the card, so it stays put while the card flips. */}
          <SwitchSideButton side={side} setSide={switchSide} />
        </div>
      </div>
    </FillRemainingHeight>
  );
}

function Pane({
  tabs,
  children,
}: {
  tabs: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {tabs}
      <div className={styles.paneBody}>{children}</div>
    </>
  );
}

export default MonacoEditorComponent;
