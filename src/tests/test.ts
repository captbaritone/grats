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
import { graphql, GraphQLSchema } from "graphql";
import { Command } from "commander";
import { locate } from "../Locate";
import { gqlErr, ReportableDiagnostics } from "../utils/DiagnosticError";
import { writeFileSync } from "fs";
import { codegen } from "../codegen";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { diff } from "jest-diff";
import { printSDLWithoutDirectives } from "../printSchema";
import { METADATA_DIRECTIVE_NAMES } from "../metadataDirectives";
import * as semver from "semver";

const TS_VERSION = ts.version;

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
    for (const {
      fixturesDir,
      transformer,
      testFilePattern,
      ignoreFilePattern,
    } of testDirs) {
      const runner = new TestRunner(
        fixturesDir,
        !!write,
        filterRegex,
        testFilePattern,
        ignoreFilePattern,
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
    testFilePattern: /\.ts$/,
    ignoreFilePattern: null,
    transformer: (code: string, fileName: string): string | false => {
      const firstLine = code.split("\n")[0];
      let options: Partial<ConfigOptions> = {
        nullableByDefault: true,
        schemaHeader: null,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const { tsVersion, ...testOptions } = JSON.parse(json);
        if (tsVersion != null && !semver.satisfies(TS_VERSION, tsVersion)) {
          console.log(
            "Skipping test because TS version doesn't match",
            tsVersion,
            "does not match",
            TS_VERSION,
          );
          return false;
        }
        options = { ...options, ...testOptions };
      }

      const files = [
        `${fixturesDir}/${fileName}`,
        path.join(__dirname, `../Types.ts`),
      ];
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
      const executableSchema = codegen(
        schemaResult.value,
        `${fixturesDir}/${fileName}`,
      );

      const LOCATION_REGEX = /^\/\/ Locate: (.*)/;
      const locationMatch = code.match(LOCATION_REGEX);
      if (locationMatch != null) {
        const locResult = locate(schemaResult.value, locationMatch[1].trim());
        if (locResult.kind === "ERROR") {
          return locResult.err;
        }

        return new ReportableDiagnostics(compilerHost, [
          gqlErr(locResult.value, "Located here"),
        ]).formatDiagnosticsWithContext();
      } else {
        const sansDirectives = new GraphQLSchema({
          ...schemaResult.value.toConfig(),
          directives: schemaResult.value.getDirectives().filter((directive) => {
            return !METADATA_DIRECTIVE_NAMES.has(directive.name);
          }),
        });
        const sdl = printSchemaWithDirectives(sansDirectives, {
          assumeValid: true,
        });

        return `-- SDL --\n${sdl}\n-- TypeScript --\n${executableSchema}`;
      }
    },
  },
  {
    fixturesDir: integrationFixturesDir,
    testFilePattern: /index.ts$/,
    ignoreFilePattern: /schema.ts$/,
    transformer: async (
      code: string,
      fileName: string,
    ): Promise<string | false> => {
      const filePath = `${integrationFixturesDir}/${fileName}`;
      const schemaPath = path.join(path.dirname(filePath), "schema.ts");

      const options: Partial<ConfigOptions> = {
        nullableByDefault: true,
      };
      const files = [filePath, path.join(__dirname, `../Types.ts`)];
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

      const tsSchema = codegen(schemaResult.value, schemaPath);

      writeFileSync(schemaPath, tsSchema);

      const server = await import(filePath);

      if (server.query == null || typeof server.query !== "string") {
        throw new Error(
          `Expected \`${filePath}\` to export a query text as \`query\``,
        );
      }

      const schemaModule = await import(schemaPath);

      const actualSchema = schemaModule.getSchema(server.config);

      const schemaDiff = compareSchemas(actualSchema, schemaResult.value);

      if (schemaDiff) {
        console.log(schemaDiff);
        // TODO: Make this an actual test failure, not an error
        throw new Error("The codegen schema does not match the SDL schema.");
      }

      const data = await graphql({
        schema: actualSchema,
        source: server.query,
        variableValues: server.variables,
      });

      return JSON.stringify(data, null, 2);
    },
  },
];

// Returns null if the schemas are equal, otherwise returns a string diff.
function compareSchemas(
  actual: GraphQLSchema,
  expected: GraphQLSchema,
): string | null {
  const actualSDL = printSDLWithoutDirectives(actual);
  const expectedSDL = printSDLWithoutDirectives(expected);

  if (actualSDL === expectedSDL) {
    return null;
  }

  return diff(expectedSDL, actualSDL);
}

program.parse();
