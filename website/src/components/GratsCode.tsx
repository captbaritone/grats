import React, { useMemo, useState } from "react";
import CodeBlock from "@theme/CodeBlock";
import { serializeState } from "./MonacoPlayground/urlState";
import { URL_VERSION } from "./MonacoPlayground/defaultState";
import Link from "@docusaurus/Link";
import { parseLines, useThemeConfig } from "@docusaurus/theme-common/internal";
import { usePrismTheme } from "@docusaurus/theme-common";

type Props = {
  out: string;
  mode: "ts" | "gql" | "codegen" | "both";
};

export default function GratsCode({ out, mode }: Props) {
  const [ts, gql, codegen] = useMemo(() => {
    if (typeof out !== "string") {
      throw new Error("Expected out prop to be string");
    }
    const chunks = out.split("=== SNIP ===").map((str) => str.trim());
    if (chunks.length !== 3) {
      throw new Error("Expected children to be special grats code");
    }
    return chunks;
  }, [out]);

  switch (mode) {
    case "ts":
      return (
        <div style={{ position: "relative" }}>
          <CodeBlock language="tsx">{ts}</CodeBlock>
          <PlaygroundLink ts={ts} />
        </div>
      );
    case "gql":
      return <CodeBlock language="graphql">{gql}</CodeBlock>;
    case "codegen":
      return <CodeBlock language="tsx">{codegen}</CodeBlock>;
    case "both":
      return <BothView ts={ts} gql={gql} />;
    default:
      throw new Error(`Unexpected GratsCode mode "${mode}".`);
  }
}

function BothView({ ts, gql }: { ts: string; gql: string }) {
  const [tab, setTab] = useState<"ts" | "gql">("ts");
  const prismTheme = usePrismTheme();
  const bgColor = prismTheme.plain.backgroundColor as string;

  return (
    <div className="grats-both">
      <div className="grats-both__bar">
        <button
          className={`grats-both__tab ${
            tab === "ts" ? "grats-both__tab--active" : ""
          }`}
          onClick={() => setTab("ts")}
          style={tab === "ts" ? { background: bgColor } : undefined}
        >
          TypeScript
        </button>
        <button
          className={`grats-both__tab ${
            tab === "gql" ? "grats-both__tab--active" : ""
          }`}
          onClick={() => setTab("gql")}
          style={tab === "gql" ? { background: bgColor } : undefined}
        >
          GraphQL
        </button>
      </div>
      <div style={tab === "ts" ? { position: "relative" } : { display: "none" }}>
        <CodeBlock language="tsx">{ts}</CodeBlock>
        <PlaygroundLink ts={ts} />
      </div>
      <div style={tab === "gql" ? {} : { display: "none" }}>
        <CodeBlock language="graphql">{gql}</CodeBlock>
      </div>
    </div>
  );
}

function PlaygroundLink({ ts }) {
  const {
    prism: { magicComments },
  } = useThemeConfig();
  const playgroundLink = useMemo(() => {
    const { code: doc } = parseLines(ts, {
      language: "typescript",
      metastring: null,
      magicComments,
    });
    const hash = serializeState({
      doc,
      config: {
        nullableByDefault: true,
        reportTypeScriptTypeErrors: true,
      },
      view: {
        showGratsDirectives: false,
      },
      VERSION: URL_VERSION,
    });
    return `/playground/#${hash}`;
  }, [ts]);

  return (
    <Link
      to={playgroundLink}
      style={{
        position: "absolute",
        color: "var(--ifm-color-primary-lightest)",
        bottom: 16,
        right: 16,
        fontSize: "0.8rem",
      }}
    >
      Playground
    </Link>
  );
}
