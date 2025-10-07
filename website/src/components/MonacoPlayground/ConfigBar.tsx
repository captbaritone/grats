import React, { useState, useRef } from "react";
import FormatButton from "./FormatButton";
import ShareButton from "./ShareButton";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { OutputOption } from "./State";
import ConfigDropdown from "./ConfigModal";

type Props = {
  viewMode: OutputOption;
  setViewMode: (mode: OutputOption) => void;
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
};

export default function ConfigBar({
  viewMode,
  setViewMode,
  config,
  onConfigChange,
}: Props): JSX.Element {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const configButtonRef = useRef<HTMLButtonElement>(null);
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
          <div style={{ position: "relative" }}>
            <button
              ref={configButtonRef}
              onClick={() => {
                setIsConfigModalOpen(!isConfigModalOpen);
              }}
              style={{
                padding: "0.3em 0.8em",
                fontSize: "0.85rem",
                backgroundColor: "var(--ifm-color-primary-dark)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "0.4em",
              }}
            >
              Config Options
              <span style={{ fontSize: "0.7em", opacity: 0.9 }}>
                {isConfigModalOpen ? "▲" : "▼"}
              </span>
            </button>
            <ConfigDropdown
              isOpen={isConfigModalOpen}
              onClose={() => setIsConfigModalOpen(false)}
              config={config}
              onConfigChange={onConfigChange}
              buttonRef={configButtonRef}
            />
          </div>
        </ConfigBlock>
        <div style={{ display: "flex", gap: "1em" }}>
          <FormatButton />
          <ShareButton />
        </div>
      </ConfigBarSide>
      <ConfigBarSide>
        <ConfigBlock>
          <ConfigBarHeading>Output:</ConfigBarHeading>
          <Label>
            <select
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value as OutputOption);
              }}
            >
              <option value="sdl">GraphQL Schema</option>
              <option value="typescript">TypeScript Schema</option>
              <option value="tsClientEnums">TypeScript Client Enums</option>
              <hr />
              <option value="resolverMap">[Experimental] Resolver Map</option>
              <option value="resolverSignatures">
                [Experimental] Metadata
              </option>
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
