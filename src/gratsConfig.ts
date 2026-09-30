import type { GratsConfig } from "./TGratsConfig.js";

/**
 * For Grats's config object we need the following:
 *
 * - Post/parsing/validation TypeScript type
 * - Runtime validation
 * - Documentation (in code and on website)
 * - Dynamic config editor in the playground
 *
 * And we need to ensure all four stay in sync. To that end, we define the
 * config spec in JSON, which is used to generate the TypeScript type,
 * runtime validation, documentation, and the interactive config editor in
 * the playground. Validation happens in Rust (see
 * `grats-rs/crates/grats/src/grats_config.rs`).
 */

export { GratsConfig };

export type ConfigSpec = {
  description: string;
  typeName: string;
  properties: {
    [propertyName: string]: PropertySpec;
  };
};

type PropertySpec = {
  description: string;
  type: PropertyType;
  nullable: boolean;
  default: string | boolean | null;
  experimental?: boolean;
};

type PropertyType =
  | {
      kind: "string";
    }
  | {
      kind: "longString";
    }
  | {
      kind: "boolean";
    };

export function makeTypeScriptType(spec: ConfigSpec): string {
  const lines: string[] = [];
  lines.push(`export type ${spec.typeName} = {`);
  for (const [key, property] of Object.entries(spec.properties)) {
    const typeString = (() => {
      switch (property.type.kind) {
        case "string":
        case "longString":
          return "string";
        case "boolean":
          return "boolean";
      }
    })();
    lines.push(
      `  /**`,
      simpleWordWrap(property.description, "   * ", 76),
      `   */`,
      `  ${key}: ${typeString}${property.nullable ? " | null" : ""};`,
    );
  }
  lines.push("};");
  return lines.join("\n");
}

function simpleWordWrap(
  text: string,
  linePrefix: string,
  width: number,
): string {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let currentLine = linePrefix;
    for (const word of paragraph.split(" ")) {
      if ((currentLine + " " + word).length > width) {
        lines.push(currentLine);
        currentLine = linePrefix + word;
      } else {
        if (currentLine === linePrefix) {
          currentLine += word;
        } else {
          currentLine += " " + word;
        }
      }
    }
    if (currentLine !== linePrefix) {
      lines.push(currentLine);
    }
  }
  return lines.join("\n");
}
