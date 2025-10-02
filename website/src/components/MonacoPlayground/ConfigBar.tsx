import React from "react";
import FormatButton from "./FormatButton";
import ShareButton from "./ShareButton";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { OutputOption } from "../PlaygroundFeatures/store";

type Props = {
  viewMode: OutputOption;
  setViewMode: (mode: OutputOption) => void;
  nullableByDefault: boolean;
  setNullableByDefault: (value: boolean) => void;
};

export default function ConfigBar({
  viewMode,
  setViewMode,
  nullableByDefault,
  setNullableByDefault,
}: Props): JSX.Element {
  const { gitHash } = useDocusaurusContext().siteConfig.customFields as {
    gitHash: string;
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "stretch",
        alignItems: "center",
        borderBottom: "2px solid var(--ifm-color-emphasis-300)",
        fontFamily: "Verdana, sans-serif",
        fontSize: "0.8rem",
        position: "sticky",
        bottom: 0,
        backgroundColor: "var(--ifm-color-emphasis-100)",
      }}
    >
      <ConfigBarSide>
        <ConfigBlock>
          <ConfigBarHeading>Grats config:</ConfigBarHeading>
          <Label>
            <input
              checked={nullableByDefault}
              type="checkbox"
              onChange={(e) => {
                setNullableByDefault(e.target.checked);
              }}
            />
            Make fields nullable by default
          </Label>
        </ConfigBlock>
        <div style={{ display: "flex", gap: "1em" }}>
          <FormatButton />
          <ShareButton />
        </div>
      </ConfigBarSide>
      <ConfigBarSide>
        <ConfigBlock>
          <ConfigBarHeading>View options:</ConfigBarHeading>
          <Label>
            <select
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value as OutputOption);
              }}
            >
              <option value="sdl">GraphQL Schema</option>
              <option value="typescript">TypeScript Schema</option>
              <option value="resolverSignatures">Metadata</option>
            </select>
          </Label>
        </ConfigBlock>
        <div
          style={{
            color: "#666",
            whiteSpace: "nowrap",
          }}
        >
          Version:{" "}
          <a
            href={`https://github.com/captbaritone/grats/tree/${gitHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {gitHash?.slice(0, 7)}
          </a>
        </div>
      </ConfigBarSide>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{ display: "flex", alignItems: "center" }}>{children}</label>
  );
}

function ConfigBlock({ children }) {
  return (
    <div
      style={{
        width: "100%",
        flexGrow: 1,
        display: "flex",
        flexDirection: "row",
        gap: "0.5em",
      }}
    >
      {children}
    </div>
  );
}

function ConfigBarSide({ children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        flexGrow: 1,
        padding: "0.5rem 1rem",
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

function ConfigBarHeading({ children }) {
  return (
    <strong
      style={{
        color: "#666",
        padding: "0 0.2rem 0 0",
      }}
    >
      {children}
    </strong>
  );
}
