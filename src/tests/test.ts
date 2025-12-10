import * as path from "path";
import TestRunner, { Transformer, TransformerResult } from "./TestRunner";
import {
  buildSchemaAndDocResult,
  buildSchemaAndDocResultWithHost,
} from "../lib";
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
import { locate } from "../Locate";
import { gqlErr, ReportableDiagnostics } from "../utils/DiagnosticError";
import { readFileSync, writeFileSync } from "fs";
import { codegen } from "../codegen/schemaCodegen";
import { printEnumsModule } from "../printSchema";
import { diff } from "jest-diff";
import * as semver from "semver";
import {
  GratsConfig,
  ParsedCommandLineGrats,
  validateGratsOptions,
} from "../gratsConfig";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives";
import { applySDLHeader, applyTypeScriptHeader } from "../printSchema";
import { extend } from "../utils/helpers";
import { Result, ok, err } from "../utils/Result";
import { applyFixes } from "../fixFixable";
import { writeTypeScriptTypeToDisk } from "../../scripts/buildConfigTypes";
import { Markdown } from "./Markdown";

writeTypeScriptTypeToDisk();

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

const gratsDir = path.join(__dirname, "../..");
const fixturesDir = path.join(__dirname, "fixtures");
const configFixturesDir = path.join(__dirname, "configParserFixtures");
const integrationFixturesDir = path.join(__dirname, "integrationFixtures");

type TestDir = {
  fixturesDir: string;
  testFilePattern: RegExp;
  ignoreFilePattern: RegExp | null;
  transformer: Transformer;
};

const testDirs: TestDir[] = [
  {
    fixturesDir: configFixturesDir,
    testFilePattern: /\.json$/,
    ignoreFilePattern: null,
    transformer: (
      code: string,
      _fileName: string,
    ): Result<string, Markdown> => {
      const config = JSON.parse(code);
      let parsed: ParsedCommandLineGrats;
      const warnings: string[] = [];
      const consoleWarn = console.warn;
      console.warn = (msg: string) => {
        warnings.push(msg);
      };
      try {
        const parsedResult = validateGratsOptions({
          options: {},
          raw: {
            grats: config,
          },
          errors: [],
          fileNames: [],
        });
        if (parsedResult.kind === "ERROR") {
          return err(
            formatDiagnosticsWithContext(
              code,
              ReportableDiagnostics.fromDiagnostics(parsedResult.err),
            ),
          );
        }
        parsed = parsedResult.value;
      } catch (e) {
        return err(e.message);
      }
      console.warn = consoleWarn;

      let result = `-- Parsed Config --\n${JSON.stringify(
        parsed.raw.grats,
        null,
        2,
      )}`;
      if (warnings.length > 0) {
        result += `\n-- Warnings --\n${warnings.join("\n")}`;
      }
      return ok(result);
    },
  },
  {
    fixturesDir,
    testFilePattern: /\.ts$/,
    ignoreFilePattern: null,
    transformer: (code: string, fileName: string): TransformerResult => {
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
        path.join(__dirname, `../Types.ts`),
      ];
      let parsedOptions: ParsedCommandLineGrats;
      try {
        const parsedOptionsResult = validateGratsOptions({
          options: {},
          raw: {
            grats: config,
          },
          errors: [],
          fileNames: files,
        });
        if (parsedOptionsResult.kind === "ERROR") {
          return err(
            formatDiagnosticsWithContext(
              code,
              ReportableDiagnostics.fromDiagnostics(parsedOptionsResult.err),
            ),
          );
        }
        parsedOptions = parsedOptionsResult.value;
      } catch (e) {
        return err(e.message);
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
        return err(
          formatDiagnosticsWithContext(
            code,
            ReportableDiagnostics.fromDiagnostics(schemaResult.err),
          ),
        );
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
          return err(locResult.err);
        }

        return err(
          formatDiagnosticsWithContext(
            code,
            new ReportableDiagnostics(compilerHost, [
              gqlErr({ loc: locResult.value }, "Located here"),
            ]),
          ),
        );
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

        return ok(`-- SDL --\n${sdl}\n-- TypeScript --\n${executableSchema}`);
      }
    },
  },
  {
    fixturesDir: integrationFixturesDir,
    testFilePattern: /index.ts$/,
    ignoreFilePattern: /(schema)|(enums).ts$/,
    transformer: async (
      code: string,
      fileName: string,
    ): Promise<Result<string, Markdown> | false> => {
      const firstLine = code.split("\n")[0];
      let config: Partial<GratsConfig> = {
        nullableByDefault: true,
      };
      if (firstLine.startsWith("// {")) {
        const json = firstLine.slice(3);
        const testOptions = JSON.parse(json);
        config = { ...config, ...testOptions };
      }
      const filePath = `${integrationFixturesDir}/${fileName}`;
      const schemaPath = path.join(path.dirname(filePath), "schema.ts");

      const files = [filePath, path.join(__dirname, `../Types.ts`)];
      const parsedOptionsResult = validateGratsOptions({
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
      if (parsedOptionsResult.kind === "ERROR") {
        // We don't expect integration tests to error during config parsing
        // so we throw here instead of returning a Markdown result.
        throw new Error(
          ReportableDiagnostics.fromDiagnostics(
            parsedOptionsResult.err,
          ).formatDiagnosticsWithContext(),
        );
      }
      const parsedOptions = parsedOptionsResult.value;
      const schemaResult = buildSchemaAndDocResult(parsedOptions);
      if (schemaResult.kind === "ERROR") {
        // We don't expect integration tests to error GraphQL schema building
        // so we throw here instead of returning a Markdown result.
        throw new Error(
          ReportableDiagnostics.fromDiagnostics(
            schemaResult.err,
          ).formatDiagnosticsWithContext(),
        );
      }

      const { schema, doc, resolvers } = schemaResult.value;

      const tsSchema = codegen(
        schema,
        resolvers,
        parsedOptions.raw.grats,
        schemaPath,
      );

      writeFileSync(schemaPath, tsSchema);

      // Generate enums file if tsClientEnums is configured
      if (parsedOptions.raw.grats.tsClientEnums) {
        const enumsPath = path.join(
          path.dirname(filePath),
          parsedOptions.raw.grats.tsClientEnums,
        );
        const enumsCode = printEnumsModule(
          schema,
          parsedOptions.raw.grats,
          enumsPath,
        );
        writeFileSync(enumsPath, enumsCode);
      }

      const server = await import(filePath);

      if (server.query == null || typeof server.query !== "string") {
        throw new Error(
          `Expected \`${filePath}\` to export a query text as \`query\``,
        );
      }

      const schemaModule = await import(schemaPath);

      const actualSchema = schemaModule.getSchema(server.schemaConfig);

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

      return ok(JSON.stringify(data, null, 2));
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
): Markdown {
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

  const markdown = new Markdown();
  markdown.addHeader(3, "Error Report");
  markdown.addCodeBlock(formatted, "text");

  if (actions.length === 0) {
    return markdown;
  }

  const fixable = diagnostics._diagnostics.filter((d) => d.fix != null);
  const logEvents: string[] = [];
  function log(event: string) {
    logEvents.push(event);
  }

  for (const action of actions) {
    markdown.addHeader(
      4,
      `Code Action: "${action.description}" (${action.fixName})`,
    );
    markdown.addCodeBlock(action.diff, "diff");
  }

  if (fixable.length > 0) {
    const fileName = fixable[0].file?.fileName;
    if (fileName == null) {
      throw new Error("Cannot apply fixes to diagnostic with no file");
    }

    const current = readFileSync(fileName, "utf8");
    applyFixes(diagnostics._diagnostics, { fix: true, log });
    const newText = readFileSync(fileName, "utf8");

    writeFileSync(fileName, current, "utf8");

    markdown.addHeader(4, "Applied Fixes");
    markdown.addCodeBlock(logEvents.join("\n"), "text");
    markdown.addHeader(4, "Fixed Text");
    markdown.addCodeBlock(newText, "typescript");
  }

  return markdown;
}

program.parse();
