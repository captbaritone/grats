import * as ts from "typescript";
import { err, ok, Result } from "./utils/Result";
import { invariant } from "./utils/helpers";
import { diagnosticsMessage } from "./utils/DiagnosticError";
import * as _GratsConfigSpec from "./configSpec.json";

// TypeScript does not preserve string literal types when importing JSON.
const GratsConfigSpec: ConfigSpec = _GratsConfigSpec as any;

export type GratsConfig = {
  /**
   * Where Grats should write your schema file. Path is relative to the `tsconfig.json` file.
   */
  graphqlSchema: string;
  /**
   * Where Grats should write your executable TypeScript schema file. Path is relative to the `tsconfig.json` file.
   */
  tsSchema: string;
  /**
   * Should all fields be typed as nullable in accordance with GraphQL best practices? Individual fields can declare themselves as non-nullable by adding the docblock tag `@killsParentOnException`. See https://graphql.org/learn/best-practices/#nullability
   */
  nullableByDefault: boolean;
  /**
   * Experimental feature to add `@semanticNonNull` to all fields which have non-null TypeScript return types, but which are made nullable by the `nullableByDefault` option. This feature allows clients which handle errors out of band, for example by discarding responses with errors, to know which fields are expected to be non-null in the absence of errors. See https://grats.capt.dev/docs/guides/strict-semantic-nullability. It is an error to enable `strictSemanticNullability` if `nullableByDefault` is false.
   */
  strictSemanticNullability: boolean;
  /**
   * Should Grats error if it encounters a TypeScript type error? Note that Grats will always error if it encounters a TypeScript syntax error.
   */
  reportTypeScriptTypeErrors: boolean;
  /**
   * A string to prepend to the generated schema text. Useful for copyright headers or other information to the generated file. Set to `null` to omit the default header.
   */
  schemaHeader: string | null;
  /**
   * A string to prepend to the generated TypeScript schema file. Useful for copyright headers or other information to the generated file. Set to `null` to omit the default header.
   */
  tsSchemaHeader: string | null;
  /**
   * A string to prepend to the generated TypeScript enums file. Useful for copyright headers or other information to the generated file. Set to `null` to omit the default header.
   */
  EXPERIMENTAL_tsEnumsHeader: string | null;
  /**
   * This option allows you configure an extension that will be appended to the end of all import paths in the generated TypeScript schema file. When building a package that uses ES modules, import paths must not omit the file extension. In TypeScript code this generally means import paths must end with `.js`. If set to null, no ending will be appended.
   */
  importModuleSpecifierEnding: string;
  /**
   * EXPERIMENTAL: Emit a JSON file alongside the generated schema file which contains the metadata containing information about the resolvers.
   */
  EXPERIMENTAL__emitMetadata: boolean;
  /**
   * EXPERIMENTAL: Instead of emitting a TypeScript file which creates a GraphQLSchema, emit a TypeScript file which creates a GraphQL Tools style Resolver Map. https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
   */
  EXPERIMENTAL__emitResolverMap: boolean;
  /**
   * EXPERIMENTAL: Grats will write an additional modules file alongside the generated TypeScript schema file which exports all enum types for use in front-end code.
   */
  EXPERIMENTAL__emitEnums: string | null;
};

export type ParsedCommandLineGrats = Omit<ts.ParsedCommandLine, "raw"> & {
  raw: {
    grats: GratsConfig;
  };
};

// TODO: Make this return diagnostics
export function validateGratsOptions(
  options: ts.ParsedCommandLine,
): Result<ParsedCommandLineGrats, ts.Diagnostic[]> {
  const gratsOptions = { ...(options.raw?.grats ?? {}) };
  const parsed = parseConfig<GratsConfig>(GratsConfigSpec, gratsOptions);
  if (parsed.kind === "ERROR") {
    return err([diagnosticsMessage(parsed.err)]);
  }

  return ok({
    ...options,
    raw: { ...options.raw, grats: parsed.value },
  });
}

type ConfigSpec = {
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
      ...property.description.split("\n").map((line) => `   * ${line}`),
      // `   * @default ${JSON.stringify(property.default)}`,
      `   */`,
      `  ${key}: ${typeString}${property.nullable ? " | null" : ""};`,
    );
  }
  lines.push("};");
  return lines.join("\n");
}

function parseConfig<T>(spec: ConfigSpec, config: any): Result<T, string> {
  const result: any = {};
  for (const [key, property] of Object.entries(spec.properties)) {
    if (config[key] == null) {
      if (property.default !== undefined) {
        result[key] = property.default;
        continue;
      } else if (!property.nullable) {
        return err(`Missing required property \`${key}\`.`);
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
  }
  for (const key of Object.keys(config)) {
    if (!(key in spec.properties)) {
      return err(`Unknown property \`${key}\`.`);
    }
  }
  return ok(result);
}
