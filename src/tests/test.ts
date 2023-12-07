import * as path from "path";
import TestRunner from "./TestRunner";
import {
  buildSchemaResult,
  buildSchemaResultWithHost,
  ConfigOptions,
  ParsedCommandLineGrats,
  validateGratsOptions,
} from "../lib";
import * as ts from "typescript";
import { buildSchema, graphql } from "graphql";
import { Command } from "commander";
import { locate } from "../Locate";
import {
  diagnosticAtGraphQLLocation,
  ReportableDiagnostics,
} from "../utils/DiagnosticError";
import { readFileSync } from "fs";
import { codegen } from "../codegen";
import { printSchemaWithDirectives } from "@graphql-tools/utils";

const program = new Command();

program
  .name("grats-tests")
  .description("Run Grats' internal tests")
  .option(
    "-w, --write",
    "Write the actual output of the test to the expected output files. Useful for updating tests.",
  )
  .option(
    "-f, --filter <FILTER_REGEX>",
    "A regex to filter the tests to run. Only tests with a file path matching the regex will be run.",
  )
  .action(async ({ filter, write }) => {
    const filterRegex = filter ?? null;
    let failures = false;
    for (const { fixturesDir, transformer, extension } of testDirs) {
      const runner = new TestRunner(
        fixturesDir,
        !!write,
        filterRegex,
        extension,
        transformer,
      );
      failures = !(await runner.run()) || failures;
    }
    if (failures) {
      process.exit(1);
    }
  });

const gratsDir = path.join(__dirname, "../..");
const fixturesDir = path.join(__dirname, "fixtures");
const integrationFixturesDir = path.join(__dirname, "integrationFixtures");
const codegenFixturesDir = path.join(__dirname, "codegenFixtures");

const testDirs = [
  {
    fixturesDir,
    extension: ".ts",
    transformer: (code: string, fileName: string) => {
      const firstLine = code.split("\n")[0];
      let options: Partial<ConfigOptions> = {
        nullableByDefault: true,
        schemaHeader: null,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        options = { ...options, ...testOptions };
      }
      const files = [`${fixturesDir}/${fileName}`, `src/Types.ts`];
      const parsedOptions: ParsedCommandLineGrats = validateGratsOptions({
        options: {},
        raw: {
          grats: options,
        },
        errors: [],
        fileNames: files,
      });

      // https://stackoverflow.com/a/66604532/1263117
      const compilerHost = ts.createCompilerHost(
        parsedOptions.options,
        /* setParentNodes this is needed for finding jsDocs */
        true,
      );

      const schemaResult = buildSchemaResultWithHost(
        parsedOptions,
        compilerHost,
      );
      if (schemaResult.kind === "ERROR") {
        return schemaResult.err.formatDiagnosticsWithContext();
      }

      // We run codegen here just ensure that it doesn't throw.
      codegen(schemaResult.value, `${fixturesDir}/${fileName}`);

      const LOCATION_REGEX = /^\/\/ Locate: (.*)/;
      const locationMatch = code.match(LOCATION_REGEX);
      if (locationMatch != null) {
        const locResult = locate(schemaResult.value, locationMatch[1].trim());
        if (locResult.kind === "ERROR") {
          return locResult.err;
        }

        return new ReportableDiagnostics(compilerHost, [
          diagnosticAtGraphQLLocation("Located here", locResult.value),
        ]).formatDiagnosticsWithContext();
      } else {
        return printSchemaWithDirectives(schemaResult.value, {
          assumeValid: true,
        });
      }
    },
  },
  {
    fixturesDir: integrationFixturesDir,
    extension: ".ts",
    transformer: async (code: string, fileName: string) => {
      const filePath = `${integrationFixturesDir}/${fileName}`;
      const server = await import(filePath);

      if (server.query == null || typeof server.query !== "string") {
        throw new Error(
          `Expected \`${filePath}\` to export a query text as \`query\``,
        );
      }

      const options: Partial<ConfigOptions> = {
        nullableByDefault: true,
      };
      const files = [filePath, `src/Types.ts`];
      const parsedOptions: ParsedCommandLineGrats = validateGratsOptions({
        options: {
          // Required to enable ts-node to locate function exports
          rootDir: gratsDir,
          outDir: "dist",
          configFilePath: "tsconfig.json",
        },
        raw: {
          grats: options,
        },
        errors: [],
        fileNames: files,
      });
      const schemaResult = buildSchemaResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        throw new Error(schemaResult.err.formatDiagnosticsWithContext());
      }
      const schema = schemaResult.value;

      // We run codegen here just ensure that it doesn't throw.
      codegen(schema, filePath);

      const data = await graphql({
        schema,
        source: server.query,
      });

      return JSON.stringify(data, null, 2);
    },
  },
  {
    fixturesDir: codegenFixturesDir,
    extension: ".graphql",
    transformer: async (code: string, fileName: string) => {
      const filePath = `${codegenFixturesDir}/${fileName}`;
      const sdl = readFileSync(filePath, "utf8");
      const schema = buildSchema(sdl);

      return codegen(schema, filePath);
    },
  },
];

program.parse();
