import * as path from "path";
import TestRunner from "./TestRunner.ts";
import {
  buildSchemaAndDocResult,
  buildSchemaAndDocResultWithHost,
} from "../lib.ts";
import * as ts from "typescript";
import {
  buildASTSchema,
  graphql,
  GraphQLSchema,
  print,
  printSchema,
  specifiedScalarTypes,
} from "graphql";
import { Command } from "commander";
import { locate } from "../Locate.ts";
import { gqlErr, ReportableDiagnostics } from "../utils/DiagnosticError.ts";
import { writeFileSync } from "fs";
import { codegen } from "../codegen/schemaCodegen.ts";
import { diff } from "jest-diff";
import * as semver from "semver";
import type { GratsConfig, ParsedCommandLineGrats } from "../gratsConfig.ts";
import { validateGratsOptions } from "../gratsConfig.ts";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives.ts";
import { applySDLHeader, applyTypeScriptHeader } from "../printSchema.ts";
import { extend } from "../utils/helpers.ts";

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
  .option("-i, --interactive", "Run tests in interactive mode.")
  .action(async ({ filter, write, interactive }) => {
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
      failures = !(await runner.run({ interactive })) || failures;
    }
    if (failures) {
      process.exit(1);
    }
  });

const gratsDir = path.join(".");
const testDir = path.join(gratsDir, "src", "tests");
const fixturesDir = path.join(testDir, "fixtures");
const integrationFixturesDir = path.join(testDir, "integrationFixtures");

const testDirs = [
  {
    fixturesDir,
    testFilePattern: /\.ts$/,
    ignoreFilePattern: null,
    transformer: (code: string, fileName: string): string | false => {
      const firstLine = code.split("\n")[0];
      let config: Partial<GratsConfig> = {
        nullableByDefault: true,
        schemaHeader: null,
        tsSchemaHeader: null,
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
        config = { ...config, ...testOptions };
      }

      const files = [
        `${fixturesDir}/${fileName}`,
        path.join(gratsDir, `src/Types.ts`),
      ];
      let parsedOptions: ParsedCommandLineGrats;
      try {
        parsedOptions = validateGratsOptions({
          options: {},
          raw: {
            grats: config,
          },
          errors: [],
          fileNames: files,
        });
      } catch (e) {
        return e.message;
      }

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
        return formatDiagnosticsWithContext(code, schemaResult.err);
      }

      const { schema, doc, resolvers } = schemaResult.value;

      // We run codegen here just ensure that it doesn't throw.
      const executableSchema = applyTypeScriptHeader(
        parsedOptions.raw.grats,
        codegen(
          schema,
          resolvers,
          parsedOptions.raw.grats,
          `${fixturesDir}/${fileName}`,
        ),
      );

      const LOCATION_REGEX = /^\/\/ Locate: (.*)/;
      const locationMatch = code.match(LOCATION_REGEX);
      if (locationMatch != null) {
        const locResult = locate(schema, locationMatch[1].trim());
        if (locResult.kind === "ERROR") {
          return locResult.err;
        }

        return new ReportableDiagnostics(compilerHost, [
          gqlErr({ loc: locResult.value }, "Located here"),
        ]).formatDiagnosticsWithContext();
      } else {
        const docSansDirectives = {
          ...doc,
          definitions: doc.definitions.filter((def) => {
            if (def.kind === "ScalarTypeDefinition") {
              return !specifiedScalarTypes.some(
                (scalar) => scalar.name === def.name.value,
              );
            }
            return true;
          }),
        };
        const sdl = applySDLHeader(
          parsedOptions.raw.grats,
          print(docSansDirectives),
        );

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
      let config: Partial<GratsConfig> = {
        nullableByDefault: true,
        importModuleSpecifierEnding: ".ts",
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        config = { ...config, ...testOptions };
      }
      const filePath = `${integrationFixturesDir}/${fileName}`;
      const schemaPath = path.join(path.dirname(filePath), "schema.ts");

      const files = [filePath, path.join(gratsDir, `src/Types.ts`)];
      const parsedOptions: ParsedCommandLineGrats = validateGratsOptions({
        options: {
          // Required to enable ts-node to locate function exports
          rootDir: gratsDir,
          outDir: "dist",
          configFilePath: "tsconfig.json",
        },
        raw: {
          grats: config,
        },
        errors: [],
        fileNames: files,
      });
      const schemaResult = buildSchemaAndDocResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        throw new Error(schemaResult.err.formatDiagnosticsWithContext());
      }

      const { schema, doc, resolvers } = schemaResult.value;

      const tsSchema = codegen(
        schema,
        resolvers,
        parsedOptions.raw.grats,
        schemaPath,
      );

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
        return directive.name !== SEMANTIC_NON_NULL_DIRECTIVE;
      }),
    }),
  );
}

function formatDiagnosticsWithContext(
  code: string,
  diagnostics: ReportableDiagnostics,
): string {
  const formatted = diagnostics.formatDiagnosticsWithContext();

  const actions: {
    fixName: string;
    description: string;
    diff: string;
  }[] = [];

  for (const diagnostic of diagnostics._diagnostics) {
    if (diagnostic.fix == null) {
      continue;
    }
    const textChanges: ts.TextChange[] = [];
    for (const change of diagnostic.fix.changes) {
      extend(textChanges, change.textChanges);
    }
    let newCode = code;
    // Process edits in reverse to avoid changing the span of subsequent edits
    const reversed = textChanges.slice();
    reversed.sort((a, b) => b.span.start - a.span.start);
    for (const textChange of reversed) {
      const head = newCode.slice(0, textChange.span.start);
      const tail = newCode.slice(
        textChange.span.start + textChange.span.length,
      );
      newCode = `${head}${textChange.newText}${tail}`;
    }
    const noColor = (str: string) => str;

    const diffOptions = {
      aAnnotation: "Original",
      bAnnotation: "Fixed",
      aColor: noColor,
      bColor: noColor,
      changeColor: noColor,
      commonColor: noColor,
      patchColor: noColor,
      contextLines: 1,
      expand: false,
    };

    const diffText = diff(code, newCode, diffOptions) ?? "No diff";
    actions.push({
      fixName: diagnostic.fix.fixName,
      description: diagnostic.fix.description,
      diff: diffText,
    });
  }

  if (actions.length === 0) {
    return formatted;
  }

  const actionText = actions
    .map((action) => {
      return `-- Code Action: "${action.description}" (${action.fixName}) --\n${action.diff}`;
    })
    .join("\n");

  return `-- Error Report --\n${formatted}\n${actionText}`;
}

program.parse();
