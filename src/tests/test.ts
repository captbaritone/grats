import * as path from "path";
import TestRunner from "./TestRunner";
import { buildSchemaResult, ConfigOptions } from "../lib";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import * as ts from "typescript";
import { graphql } from "graphql";
import { Command } from "commander";

const program = new Command();

program
  .name("grats-tests")
  .description("Run Grats' internal tests")
  .option(
    "-w, --write",
    "Write the actual ouput of the test to the expected output files. Useful for updating tests.",
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

const fixturesDir = path.join(__dirname, "fixtures");
const integrationFixturesDir = path.join(__dirname, "integrationFixtures");

const testDirs = [
  {
    fixturesDir,
    transformer: (code: string, fileName: string) => {
      const firstLine = code.split("\n")[0];
      let options: ConfigOptions = {
        nullableByDefault: true,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        options = { ...options, ...testOptions };
      }
      const files = [`${fixturesDir}/${fileName}`, `src/Types.ts`];
      const parsedOptions: ts.ParsedCommandLine = {
        options: {},
        raw: {
          grats: options,
        },
        errors: [],
        fileNames: files,
      };
      const schemaResult = buildSchemaResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        return schemaResult.err.formatDiagnosticsWithContext();
      }
      return printSchemaWithDirectives(schemaResult.value, {
        assumeValid: true,
      });
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
      if (server.Query == null || typeof server.Query !== "function") {
        throw new Error(
          `Expected \`${filePath}\` to export a Query type as \`Query\``,
        );
      }

      const options: ConfigOptions = {
        nullableByDefault: true,
      };
      const files = [filePath, `src/Types.ts`];
      const parsedOptions: ts.ParsedCommandLine = {
        options: {},
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
        rootValue: new server.Query(),
      });

      return JSON.stringify(data, null, 2);
    },
  },
];

program.parse();
