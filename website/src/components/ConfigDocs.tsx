import type { ConfigSpec } from "grats/src/gratsConfigBeta";

export default function ConfigDocs({ configSpec }: { configSpec: ConfigSpec }) {
  return (
    <div>
      {Object.entries(configSpec.properties).map(([key, value]) => (
        <div style={{ marginBottom: "3em" }} key={key}>
          <h3
            className="config-title"
            id={key}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            "{key}"
            <span>
              {": "}
              {(() => {
                switch (value.type.kind) {
                  case "string":
                    return "string";
                  case "longString":
                    return "string | string[]";
                  case "boolean":
                    return "boolean";
                  default: {
                    const _foo: never = value.type;
                    throw new Error(
                      `Unhandled type kind ${(value.type as any).kind}`,
                    );
                  }
                }
              })()}
              {value.nullable === false ? "" : " | null"}
            </span>
            <a
              className="hash-link"
              href={`#${key}`}
              style={{
                color: "lightgrey",
              }}
            ></a>
          </h3>

          {value.description.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <div style={{ color: "gray" }}>
            Default:{" "}
            <code>
              {typeof value.default === "string" && value.default !== ""
                ? `${value.default}`
                : JSON.stringify(value.default)}
            </code>
          </div>
        </div>
      ))}
    </div>
  );
}
