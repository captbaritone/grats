import * as ts from "typescript";
import { ParsedCommandLineGrats, validateGratsOptions } from "./gratsConfig";
import {
  ReportableDiagnostics,
  tsErrWithSource,
  tsRelatedWithSource,
} from "./utils/DiagnosticError";
import { err, ok } from "./utils/Result";
import { Result } from "./utils/Result";

export { printSDLWithoutMetadata } from "./printSchema";
export * from "./Types";
export * from "./lib";
// Used by the experimental TypeScript plugin
export { extract } from "./Extractor";
export { codegen } from "./codegen";

// #FIXME: Report diagnostics instead of throwing!
export function getParsedTsConfig(
  configFile: string,
): Result<ParsedCommandLineGrats, ReportableDiagnostics> {
  if (!configFile) {
    throw new Error("Grats: Could not find tsconfig.json");
  }

  // https://github.com/microsoft/TypeScript/blob/46d70d79cd0dd00d19e4c617d6ebb25e9f3fc7de/src/compiler/watch.ts#L216
  const configFileHost: ts.ParseConfigFileHost = ts.sys as any;
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    undefined,
    configFileHost,
  );

  if (!parsed) {
    throw new Error("Grats: Could not locate tsconfig.json");
  }

  if (parsed.errors.length > 0) {
    return err(ReportableDiagnostics.fromDiagnostics(parsed.errors));
  }

  const jsonSource = ts.readJsonConfigFile(configFile, configFileHost.readFile);
  const validator = new GratsConfigValidator(jsonSource);

  validator.validateGratsConfigJsonSource();
  if (validator._errors.length > 0) {
    return err(ReportableDiagnostics.fromDiagnostics(validator._errors));
  }

  return ok(validateGratsOptions(parsed));
}

class GratsConfigValidator {
  _jsonSource: ts.JsonSourceFile;
  _errors: ts.Diagnostic[] = [];
  _gratsConfig: { [key: string]: ts.PropertyAssignment } = {};
  constructor(jsonSource: ts.JsonSourceFile) {
    this._jsonSource = jsonSource;
  }

  validateGratsConfigJsonSource(): null {
    // We've already passed TypeScript's validation, so we can assume a few things.
    const tsconfig = this._jsonSource.statements[0].expression;

    if (!ts.isObjectLiteralExpression(tsconfig)) {
      throw new Error("Expected object");
    }

    const gratsProperty = tsconfig.properties.find(
      (prop): prop is ts.PropertyAssignment => {
        return (
          ts.isPropertyAssignment(prop) &&
          ts.isStringLiteral(prop.name) &&
          prop.name.text === "grats"
        );
      },
    );

    if (gratsProperty == null) {
      return null;
    }

    const gratsObject = gratsProperty.initializer;
    if (!ts.isObjectLiteralExpression(gratsObject)) {
      return this.report(
        gratsObject,
        "Expected Grats config to be an object (`{}`) if provided.",
      );
    }
    return this.validateGratsObject(gratsObject);
  }

  validateGratsObject(gratsObject: ts.ObjectLiteralExpression): null {
    for (const prop of gratsObject.properties) {
      this.validateGratsConfigOption(prop);
    }

    // TODO: What about defaults?
    if (
      this._gratsConfig.nullableByDefault &&
      this._gratsConfig.nullableByDefault.initializer.kind ===
        ts.SyntaxKind.FalseKeyword &&
      this._gratsConfig.strictSemanticNullability &&
      this._gratsConfig.strictSemanticNullability.initializer.kind ===
        ts.SyntaxKind.TrueKeyword
    ) {
      this.report(
        this._gratsConfig.strictSemanticNullability.initializer,
        "Grats: The Grats config option `strictSemanticNullability` cannot be true if `nullableByDefault` is false.",
        [
          tsRelatedWithSource(
            this._gratsConfig.nullableByDefault.initializer,
            this._jsonSource,
            "`nullableByDefault` is defined here.",
          ),
        ],
      );
    }

    return null;
  }

  validateGratsConfigOption(prop: ts.ObjectLiteralElementLike) {
    if (!ts.isPropertyAssignment(prop)) {
      // Should be part of JSON validation
      throw new Error("Unexpected non-property assignment in JSON");
    }
    if (!ts.isStringLiteral(prop.name)) {
      // Should be part of JSON validation
      throw new Error("Unexpected non-string object key in JSON");
    }
    const key = prop.name.text;
    if (this._gratsConfig[key] !== undefined) {
      this.report(prop.name, "Unexpected duplicate Grats config option", [
        tsRelatedWithSource(
          this._gratsConfig[key],
          this._jsonSource,
          `\`${key}\` was already defined here.`,
        ),
      ]);
    }
    const option = GRATS_CONFIG_OPTIONS[key];
    if (option == null) {
      const validNames = Object.keys(GRATS_CONFIG_OPTIONS)
        .map((name) => `\`${name}\``)
        .join(", ");
      return this.report(
        prop.name,
        `Unknown Grats config option \`${key}\`. Valid config options are: ${validNames}.`,
      );
    }
    this.validateOptionValue(key, option, prop.initializer);
    this._gratsConfig[key] = prop;
  }

  validateOptionValue(
    key: string,
    option: GratsConfigOption,
    value: ts.Expression,
  ) {
    switch (option.type) {
      case "boolean":
        if (
          value.kind !== ts.SyntaxKind.TrueKeyword &&
          value.kind !== ts.SyntaxKind.FalseKeyword
        ) {
          return this.report(
            value,
            `Expected \`${key}\` to be a boolean if provided.`,
          );
        }
        break;
      case "string": {
        if (!ts.isStringLiteral(value)) {
          return this.report(
            value,
            `Expected \`${key}\` to be a string if provided.`,
          );
        }
        break;
      }
    }
  }

  report(
    node: ts.Node,
    message: string,
    relatedInformation?: ts.DiagnosticRelatedInformation[],
  ): null {
    this._errors.push(
      tsErrWithSource(node, this._jsonSource, message, relatedInformation),
    );
    return null;
  }
}

type GratsConfigOption = { type: "boolean" | "string"; nullable?: true };

const GRATS_CONFIG_OPTIONS: {
  [configKey: string]: GratsConfigOption;
} = {
  graphqlSchema: {
    type: "string",
  },
  tsSchema: {
    type: "string",
  },
  nullableByDefault: {
    type: "boolean",
  },
  strictSemanticNullability: {
    type: "boolean",
  },
  reportTypeScriptTypeErrors: {
    type: "boolean",
  },
  schemaHeader: {
    type: "string",
    nullable: true,
  },
  tsSchemaHeader: {
    type: "string",
    nullable: true,
  },
};
