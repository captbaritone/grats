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
import { graphql } from "graphql";
import { Command } from "commander";
import { locate } from "../Locate";
import {
  diagnosticAtGraphQLLocation,
  ReportableDiagnostics,
} from "../utils/DiagnosticError";
import { printGratsSchema } from "../printSchema";

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
    for (const { fixturesDir, transformer } of testDirs) {
      const runner = new TestRunner(
        fixturesDir,
        !!write,
        filterRegex,
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

const testDirs = [
  {
    fixturesDir,
    transformer: (code: string, fileName: string) => {
      const firstLine = code.split("\n")[0];
      let options: ConfigOptions = {
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
        return printGratsSchema(schemaResult.value, options);
      }
    },
  },
  {
    fixturesDir: integrationFixturesDir,
    transformer: async (code: string, fileName: string) => {
      const filePath = `${integrationFixturesDir}/${fileName}`;
      const server = await import(filePath);

      if (server.query == null || typeof server.query !== "string") {
        throw new Error(
          `Expected \`${filePath}\` to export a query text as \`query\``,
        );
      }

      const options: ConfigOptions = {
        nullableByDefault: true,
      };
      const files = [filePath, `src/Types.ts`];
      const parsedOptions: ParsedCommandLineGrats = {
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
      };
      const schemaResult = buildSchemaResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        throw new Error(schemaResult.err.formatDiagnosticsWithContext());
      }
      const schema = schemaResult.value;

      const data = await graphql({
        schema,
        source: server.query,
      });

      return JSON.stringify(data, null, 2);
    },
  },
];

program.parse();
