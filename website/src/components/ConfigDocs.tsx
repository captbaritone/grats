import React from "react";
import { CONFIG_OPTIONS, ConfigOption } from "./configSchema";

export default function ConfigDocs() {
  return (
    <div>
      {CONFIG_OPTIONS.map((option) => (
        <React.Fragment key={option.name}>
          <hr />
          <div style={{ marginBottom: "3em" }} key={option.name}>
            <h3
              className="config-title"
              id={option.name}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              "{option.name}"
              <span>
                {": "}
                {(() => {
                  switch (option.kind) {
                    case "string":
                      return "string";
                    case "longString":
                      return "string | string[]";
                    case "boolean":
                      return "boolean";
                  }
                })()}
                {option.nullable ? " | null" : ""}
              </span>
              <a
                className="hash-link"
                href={`#${option.name}`}
                style={{
                  color: "lightgrey",
                }}
              ></a>
            </h3>

            {option.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            <div style={{ color: "gray" }}>
              Default: <DefaultValue option={option} />
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function DefaultValue({ option }: { option: ConfigOption }) {
  switch (option.kind) {
    case "string":
      return <code>"{option.default}"</code>;
    case "longString":
      return <pre>{option.default}</pre>;
    case "boolean":
      return <code>{JSON.stringify(option.default)}</code>;
  }
}
