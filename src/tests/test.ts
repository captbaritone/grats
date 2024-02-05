import * as path from "path";
import TestRunner from "./TestRunner";
import {
  buildSchemaAndDocResult,
  buildSchemaAndDocResultWithHost,
} from "../lib";
import * as ts from "typescript";
import {
  buildASTSchema,
  graphql,
  GraphQLSchema,
  parse,
  print,
  printSchema,
  specifiedScalarTypes,
} from "graphql";
import { Command } from "commander";
import { locate } from "../Locate";
import { gqlErr, ReportableDiagnostics } from "../utils/DiagnosticError";
import { writeFileSync } from "fs";
import { codegen } from "../codegen";
import { queryCodegen } from "../queryCodegen";
import { diff } from "jest-diff";
import { METADATA_DIRECTIVE_NAMES } from "../metadataDirectives";
import * as semver from "semver";
import {
  ConfigOptions,
  ParsedCommandLineGrats,
  validateGratsOptions,
} from "../gratsConfig";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives";

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
const persistFixturesDir = path.join(__dirname, "persistFixtures");

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

      const schemaResult = buildSchemaAndDocResultWithHost(
        parsedOptions,
        compilerHost,
      );
      if (schemaResult.kind === "ERROR") {
        return schemaResult.err.formatDiagnosticsWithContext();
      }

      const { schema, doc } = schemaResult.value;

      // We run codegen here just ensure that it doesn't throw.
      const executableSchema = codegen(schema, `${fixturesDir}/${fileName}`);

      const LOCATION_REGEX = /^\/\/ Locate: (.*)/;
      const locationMatch = code.match(LOCATION_REGEX);
      if (locationMatch != null) {
        const locResult = locate(schema, locationMatch[1].trim());
        if (locResult.kind === "ERROR") {
          return locResult.err;
        }

        return new ReportableDiagnostics(compilerHost, [
          gqlErr(locResult.value, "Located here"),
        ]).formatDiagnosticsWithContext();
      } else {
        const docSansDirectives = {
          ...doc,
          definitions: doc.definitions.filter((def) => {
            if (def.kind === "DirectiveDefinition") {
              return !METADATA_DIRECTIVE_NAMES.has(def.name.value);
            }
            if (def.kind === "ScalarTypeDefinition") {
              return !specifiedScalarTypes.some(
                (scalar) => scalar.name === def.name.value,
              );
            }
            return true;
          }),
        };
        const sdl = print(docSansDirectives);

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
      const firstLine = code.split("\n")[0];
      let options: Partial<ConfigOptions> = {
        nullableByDefault: true,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        options = { ...options, ...testOptions };
      }
      const filePath = `${integrationFixturesDir}/${fileName}`;
      const schemaPath = path.join(path.dirname(filePath), "schema.ts");

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
      const schemaResult = buildSchemaAndDocResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        throw new Error(schemaResult.err.formatDiagnosticsWithContext());
      }

      const { schema, doc } = schemaResult.value;

      const tsSchema = codegen(schema, schemaPath);

      writeFileSync(schemaPath, tsSchema);

      const server = await import(filePath);

      if (server.query == null || typeof server.query !== "string") {
        throw new Error(
          `Expected \`${filePath}\` to export a query text as \`query\``,
        );
      }

      const schemaModule = await import(schemaPath);

      const actualSchema = schemaModule.getSchema();

      const schemaDiff = compareSchemas(actualSchema, buildASTSchema(doc));

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
  {
    fixturesDir: persistFixturesDir,
    testFilePattern: /\.ts$/,
    transformer: async (
      code: string,
      fileName: string,
    ): Promise<string | false> => {
      const firstLine = code.split("\n")[0];
      let options: Partial<ConfigOptions> = {
        nullableByDefault: true,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        options = { ...options, ...testOptions };
      }
      const filePath = `${persistFixturesDir}/${fileName}`;

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
      const schemaResult = buildSchemaAndDocResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        throw new Error(schemaResult.err.formatDiagnosticsWithContext());
      }
      const mod = await import(filePath);
      if (mod.operation == null) {
        throw new Error(
          `Expected \`${filePath}\` to export a operation text as \`operation\``,
        );
      }

      const operationDocument = parse(mod.operation, { noLocation: true });

      const { schema } = schemaResult.value;

      const tsQuery = queryCodegen(schema, operationDocument, "./");

      return tsQuery;
    },
  },
];

// Returns null if the schemas are equal, otherwise returns a string diff.
function compareSchemas(
  actual: GraphQLSchema,
  expected: GraphQLSchema,
): string | null {
  const actualSDL = printSDLFromSchemaWithoutDirectives(actual);
  const expectedSDL = printSDLFromSchemaWithoutDirectives(expected);

  if (actualSDL === expectedSDL) {
    return null;
  }

  return diff(expectedSDL, actualSDL);
}

function printSDLFromSchemaWithoutDirectives(schema: GraphQLSchema): string {
  return printSchema(
    new GraphQLSchema({
      ...schema.toConfig(),
      directives: schema.getDirectives().filter((directive) => {
        return (
          !METADATA_DIRECTIVE_NAMES.has(directive.name) &&
          directive.name !== SEMANTIC_NON_NULL_DIRECTIVE
        );
      }),
    }),
  );
}

program.parse();
