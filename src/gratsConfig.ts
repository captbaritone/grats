import * as ts from "typescript";
import { err, ok, Result } from "./utils/Result";
import { invariant } from "./utils/helpers";
import { locationlessErr } from "./utils/DiagnosticError";
import { GratsConfigSpec } from "./configSpec";
import { GratsConfig } from "./TGratsConfig";

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
 * the playground.
 */

export { GratsConfig };

export type ParsedCommandLineGrats = Omit<ts.ParsedCommandLine, "raw"> & {
  raw: {
    grats: GratsConfig;
  };
};

export function validateGratsOptions(
  options: ts.ParsedCommandLine,
): Result<ParsedCommandLineGrats, ts.Diagnostic[]> {
  const gratsOptions = { ...(options.raw?.grats ?? {}) };
  const parsed = parseConfig<GratsConfig>(GratsConfigSpec, gratsOptions);
  if (parsed.kind === "ERROR") {
    return err([locationlessErr(parsed.err)]);
  }

  return ok({
    ...options,
    raw: { ...options.raw, grats: parsed.value },
  });
}

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
  ignoreInPlayground?: boolean;
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

function typeName(typeKind: PropertySpec["type"]["kind"]): string {
  switch (typeKind) {
    case "string":
      return "string";
    case "longString":
      return "string | string[]";
    case "boolean":
      return "boolean";
    default: {
      const _foo: never = typeKind;
      invariant(false, `Unknown type kind ${(typeKind as any).kind}`);
    }
  }
}

function parseConfig<T>(spec: ConfigSpec, config: any): Result<T, string> {
  const result: any = {};
  for (const [key, property] of Object.entries(spec.properties)) {
    if (config[key] === undefined) {
      result[key] = property.default;
      continue;
    }
    if (config[key] === null) {
      if (!property.nullable) {
        return err(
          `The Grats config option \`${key}\` must be a \`${typeName(property.type.kind)}\` if provided.`,
        );
      } else {
        result[key] = null;
        continue;
      }
    }
    const value = config[key];
    switch (property.type.kind) {
      case "string":
        if (typeof value !== "string") {
          return err(
            `Expected property \`${key}\` to be a string, but got ${JSON.stringify(
              value,
            )}.`,
          );
        }
        result[key] = value;
        break;
      case "longString":
        if (typeof value === "string") {
          result[key] = value;
        } else if (
          Array.isArray(value) &&
          value.every((v) => typeof v === "string")
        ) {
          result[key] = value.join("\n");
        } else {
          return err(
            `Expected property \`${key}\` to be a string or array of strings, but got ${JSON.stringify(
              value,
            )}.`,
          );
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          return err(
            `Expected property \`${key}\` to be a boolean, but got ${JSON.stringify(
              value,
            )}.`,
          );
        }
        result[key] = value;
        break;
      default:
        invariant(false, `Unknown property type ${(property as any).type}`);
    }
    if (property.experimental) {
      console.warn(
        `Grats: The \`${key}\` option is experimental and will be renamed or removed in a future release.`,
      );
    }
  }
  for (const key of Object.keys(config)) {
    if (!(key in spec.properties)) {
      return err(`Unknown Grats config option \`${key}\`.`);
    }
  }
  return ok(result);
}
