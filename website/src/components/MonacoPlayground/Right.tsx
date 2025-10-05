import React, { useMemo, useState, forwardRef, useEffect } from "react";
import { useColorMode } from "@docusaurus/theme-common";
import { SANDBOX } from "./Sandbox";
import { OutputOption } from "./State";
import { Editor } from "./Editor";
import { LoadingFallback } from "./LoadingFallback";

type WorkerTransform<T> = (worker: any) => Promise<T>;

type RightProps = {
  transform: WorkerTransform<string>;
  language: "typescript" | "graphql" | "json";
};

export interface RightRef {
  layout: () => void;
}

export const Right = forwardRef<RightRef, { viewMode: OutputOption }>(
  ({ viewMode }, ref) => {
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
      return <LoadingFallback />;
    }
    return (
      <Editor
        ref={ref}
        value={value}
        language={props.language}
        theme={theme}
        readOnly={true}
      />
    );
  },
);

Right.displayName = "Right";

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
