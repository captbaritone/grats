import React, { useEffect, useMemo, useState } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import MonacoEditor from "react-monaco-editor";
import { SANDBOX } from "./Sandbox";
import { OutputOption } from "../PlaygroundFeatures/store";
import LogoSvg from "@site/static/img/logo.svg";

type WorkerTransform<T> = (worker: any) => Promise<T>;

type RightProps = {
  transform: WorkerTransform<string>;
  language: "typescript" | "graphql" | "json";
};

export function Right({ viewMode }: { viewMode: OutputOption }) {
  const props = useMemo<RightProps>(() => {
    switch (viewMode) {
      case "typescript":
        return {
          transform: (worker) => worker.getTsSchema(),
          language: "typescript" as const,
        };
      case "sdl":
        return {
          transform: (worker) => worker.getGraphQLSchema(),
          language: "graphql" as const,
        };
      case "resolverSignatures":
        return {
          transform: (worker) => worker.getResolverSignatures(),
          language: "json" as const,
        };
      default:
        throw new Error("Ooops");
    }
  }, [viewMode]);
  const value = useWorkerValue(props.transform);
  const { colorMode } = useColorMode();
  const theme = colorMode === "dark" ? "vs-dark" : "vs-light";
  if (value == null) {
    return <FallbackRight />;
  }
  return (
    <MonacoEditor
      value={value || "Loading..."}
      language={props.language}
      theme={theme}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        readOnly: true,
      }}
    />
  );
}

// Show a vertically and horizontally centered loading animation
function FallbackRight() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        width: "100%",
        fontSize: 24,
        color: "var(--ifm-color-primary)",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          position: "relative",
        }}
      >
        <LogoSvg
          style={{
            animation: "spinPulse 2s linear infinite",
          }}
        />
      </div>
    </div>
  );
}

function useWorkerValue<T>(fn: WorkerTransform<T>): T | null {
  const [state, setState] = useState<T | null>(null);
  useEffect(() => {
    let unmounted = false;

    async function setValue() {
      const worker = await SANDBOX.getWorker();
      if (unmounted) return;
      const t = await fn(worker);
      if (unmounted) return;
      setState(t);
    }
    const disposable = SANDBOX.onTSDidChange(async () => {
      setValue();
    });

    setValue();
    return () => {
      unmounted = true;
      if (disposable) {
        disposable.dispose();
      }
    };
  }, [fn]);
  return state;
}
