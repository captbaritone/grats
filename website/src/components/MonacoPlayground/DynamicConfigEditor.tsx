import React from "react";
import type { ConfigSpec } from "grats/src/gratsConfig";

type ConfigValue = string | boolean | null;

type ConfigEditorProps = {
  configSpec: ConfigSpec;
  config: Record<string, ConfigValue>;
  onConfigChange: (key: string, value: ConfigValue) => void;
};

export default function DynamicConfigEditor({
  configSpec,
  config,
  onConfigChange,
}: ConfigEditorProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75em",
        padding: "0.75em",
        maxHeight: "500px",
        overflowY: "auto",
        backgroundColor: "var(--ifm-background-surface-color)",
      }}
    >
      {Object.entries(configSpec.properties).map(([key, property]) => {
        const value = config[key] ?? property.default;
        const isExperimental = property.experimental;

        return (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4em",
              padding: "0.75em",
              border: "1px solid var(--ifm-color-emphasis-300)",
              borderRadius: "4px",
              backgroundColor: "var(--ifm-card-background-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5em",
              }}
            >
              <strong style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                {key}
              </strong>
              {isExperimental && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "0.1em 0.4em",
                    backgroundColor: "var(--ifm-color-warning-light)",
                    color: "var(--ifm-color-warning-dark)",
                    borderRadius: "3px",
                    fontWeight: "bold",
                  }}
                >
                  EXPERIMENTAL
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--ifm-color-emphasis-700)",
                lineHeight: "1.3",
              }}
            >
              {property.description}
            </div>

            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5em" }}
            >
              <ConfigControl
                property={property}
                value={value}
                onChange={(newValue) => onConfigChange(key, newValue)}
              />
              <DefaultValue value={property.default} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Component to display the default value
function DefaultValue({ value }: { value: any }) {
  const formatted = (() => {
    if (value === null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string") {
      // Truncate long strings
      if (value.length > 50) {
        return `"${value.substring(0, 47)}..."`;
      }
      return `"${value}"`;
    }
    return String(value);
  })();

  return (
    <span
      style={{
        fontSize: "0.75rem",
        color: "var(--ifm-color-emphasis-600)",
      }}
    >
      Default: {formatted}
    </span>
  );
}

// Common input styles
const INPUT_STYLE: React.CSSProperties = {
  padding: "0.4em 0.6em",
  borderRadius: "4px",
  border: "1px solid var(--ifm-color-emphasis-400)",
  fontFamily: "monospace",
  fontSize: "0.85rem",
  width: "100%",
};

// Nullable checkbox component
function NullableCheckbox({
  value,
  defaultValue,
  onChange,
}: {
  value: ConfigValue;
  defaultValue: any;
  onChange: (value: ConfigValue) => void;
}) {
  return (
    <label
      style={{
        fontSize: "0.75rem",
        display: "flex",
        alignItems: "center",
        gap: "0.3em",
      }}
    >
      <input
        type="checkbox"
        checked={value === null}
        onChange={(e) => onChange(e.target.checked ? null : defaultValue)}
      />
      Set to null
    </label>
  );
}

// String/LongString input wrapper
function StringInputWrapper({
  value,
  defaultValue,
  nullable,
  onChange,
  children,
}: {
  value: ConfigValue;
  defaultValue: any;
  nullable: boolean;
  onChange: (value: ConfigValue) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.3em",
        width: "100%",
      }}
    >
      {children}
      {nullable && (
        <NullableCheckbox
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
        />
      )}
    </div>
  );
}

// Component to render the appropriate control based on property type
function ConfigControl({
  property,
  value,
  onChange,
}: {
  property: any;
  value: ConfigValue;
  onChange: (value: ConfigValue) => void;
}) {
  switch (property.type.kind) {
    case "boolean":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span style={{ fontSize: "0.9rem" }}>
            {value ? "Enabled" : "Disabled"}
          </span>
        </label>
      );

    case "string":
      return (
        <StringInputWrapper
          value={value}
          defaultValue={property.default}
          nullable={property.nullable}
          onChange={onChange}
        >
          <input
            type="text"
            value={value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={String(property.default)}
            style={INPUT_STYLE}
          />
        </StringInputWrapper>
      );

    case "longString":
      return (
        <StringInputWrapper
          value={value}
          defaultValue={property.default}
          nullable={property.nullable}
          onChange={onChange}
        >
          <textarea
            value={value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={String(property.default)}
            rows={3}
            style={{ ...INPUT_STYLE, resize: "vertical" }}
          />
        </StringInputWrapper>
      );

    default:
      return <span>Unsupported type</span>;
  }
}
