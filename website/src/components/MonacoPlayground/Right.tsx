import React, { useState, useEffect } from "react";
import { SANDBOX } from "./Sandbox";
import { OutputOption, SerializableState } from "./State";
import type { FileTab } from "./FileTabs";
import { GraphQLFileIcon, JsonFileIcon, TypeScriptFileIcon } from "./icons";
import type { GratsWorker } from "../../workers/grats.worker";
import { Editor } from "./Editor";
import { LoadingFallback } from "./LoadingFallback";

type WorkerTransform<T> = (worker: GratsWorker) => Promise<T>;

type Output = Omit<FileTab<OutputOption>, "name"> & {
  transform: WorkerTransform<string>;
  language: "typescript" | "graphql" | "json";
  /** The option naming the file, if any, and its name if that's unset. */
  path: { option?: string; fallback: string };
};

/** The files Grats generates from the code. */
const OUTPUTS: Output[] = [
  {
    id: "sdl",
    path: { option: "graphqlSchema", fallback: "schema.graphql" },
    icon: <GraphQLFileIcon />,
    description: "The GraphQL schema Grats extracted from the code.",
    transform: (worker) => worker.getGraphQLSchema(),
    language: "graphql",
  },
  {
    id: "typescript",
    path: { option: "tsSchema", fallback: "schema.ts" },
    icon: <TypeScriptFileIcon />,
    description:
      "The executable schema Grats generated, which calls the code's resolvers.",
    transform: (worker) => worker.getTsSchema(),
    language: "typescript",
  },
  {
    id: "tsClientEnums",
    path: { option: "tsClientEnums", fallback: "enums.ts" },
    icon: <TypeScriptFileIcon />,
    description: "The schema's enums, as TypeScript, for reuse on the client.",
    transform: (worker) => worker.getTsClientEnums(),
    language: "typescript",
  },
  {
    id: "resolverMap",
    path: { fallback: "resolvers.ts" },
    icon: <TypeScriptFileIcon />,
    description:
      "A resolver map, for tools like graphql-tools, in place of the executable schema.",
    experimental: true,
    transform: (worker) => worker.getResolverMap(),
    language: "typescript",
  },
  {
    id: "resolverSignatures",
    path: { fallback: "metadata.json" },
    icon: <JsonFileIcon />,
    description:
      "Grats' internal representation of the resolvers it found. Future versions may expose it to other tools.",
    experimental: true,
    transform: (worker) => worker.getResolverSignatures(),
    language: "json",
  },
];

/** The files Grats generates, named as the config asks for them. */
export function getOutputTabs(
  config: SerializableState["config"],
): FileTab<OutputOption>[] {
  return OUTPUTS.map(({ path, ...output }) => {
    const value = path.option == null ? null : config[path.option];
    const name =
      typeof value === "string" ? value.split("/").pop()! : path.fallback;
    return { ...output, name };
  });
}

/** One of the files Grats generates from the code. */
export function Right({ output }: { output: OutputOption }) {
  const { transform, language } = OUTPUTS.find(({ id }) => id === output)!;
  const value = useWorkerValue(transform);
  if (value == null) {
    return <LoadingFallback />;
  }
  return <Editor value={value} language={language} readOnly={true} />;
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
