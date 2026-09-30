import * as path from "path";
import { fileURLToPath } from "url";
import TestRunner, { Transformer, TransformerResult } from "./TestRunner.js";
import {
  buildSchemaAndDocResult,
  buildSchemaAndDocResultWithHost,
} from "../lib.js";
import * as ts from "typescript";
import { buildASTSchema, graphql, GraphQLSchema, printSchema } from "graphql";
import { Command } from "commander";
import { locate } from "../Locate.js";
import { gqlErr, ReportableDiagnostics } from "../utils/DiagnosticError.js";
import { readFileSync, writeFileSync } from "fs";
import { diff } from "jest-diff";
import * as prettier from "prettier";
import * as semver from "semver";
import {
  GratsConfig,
  ParsedCommandLineGrats,
  validateGratsOptions,
} from "../gratsConfig.js";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives.js";
import { printOutputs } from "../printSchema.js";
import { extend, nullThrows } from "../utils/helpers.js";
import { Result, ok, err } from "../utils/Result.js";
import { applyFixes } from "../fixFixable.js";
import { writeTypeScriptTypeToDisk } from "../../scripts/buildConfigTypes.js";
import { Markdown } from "./Markdown.js";
import { assertDocumentRoundTrips } from "./codecRoundTrip.js";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    ): Result<Markdown, Markdown> => {
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
      } catch (e: any) {
        return err(e.message);
      }
      console.warn = consoleWarn;

      const markdown = new Markdown();

      markdown.addHeader(3, "Parsed Config");
      markdown.addCodeBlock(JSON.stringify(parsed.raw.grats, null, 2), "json");
      if (warnings.length > 0) {
        markdown.addHeader(3, "Warnings");
        markdown.addCodeBlock(warnings.join("\n"), "text");
      }
      return ok(markdown);
    },
  },
  {
    fixturesDir,
    testFilePattern: /\.ts$/,
    ignoreFilePattern: null,
    transformer: async (
      code: string,
      fileName: string,
    ): Promise<TransformerResult> => {
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
      } catch (e: any) {
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

      const { doc } = schemaResult.value;

      assertDocumentRoundTrips(doc);

      const fixturePath = `${fixturesDir}/${fileName}`;
      const { tsClientEnums } = parsedOptions.raw.grats;
      // We print every output here, even for `// Locate:` fixtures, to ensure
      // that printing doesn't throw.
      const outputs = printOutputs(
        schemaResult.value,
        parsedOptions.raw.grats,
        {
          graphqlSchema: true,
          tsSchema: fixturePath,
          tsClientEnums:
            tsClientEnums == null
              ? undefined
              : path.join(path.dirname(fixturePath), tsClientEnums),
          metadata: parsedOptions.raw.grats.EXPERIMENTAL__emitMetadata,
        },
      );

      const LOCATION_REGEX = /^\/\/ Locate: (.*)/;
      const locationMatch = code.match(LOCATION_REGEX);
      if (locationMatch != null) {
        const locResult = locate(doc, locationMatch[1].trim());
        if (locResult.kind === "ERROR") {
          const markdown = new Markdown();
          markdown.addHeader(3, "Error Locating Type");
          markdown.addCodeBlock(locResult.err, "text");
          return err(markdown);
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
        const markdown = new Markdown();
        markdown.addHeader(3, "SDL");
        markdown.addCodeBlock(nullThrows(outputs.graphqlSchema), "graphql");
        markdown.addHeader(3, "TypeScript");
        // Goldens record the generated TypeScript after prettier formatting so
        // that they assert on the code's structure rather than on the exact
        // whitespace choices of the printer that emitted it.
        markdown.addCodeBlock(
          await prettier.format(nullThrows(outputs.tsSchema), {
            parser: "typescript",
            // The printers differ in when they put an object's properties on
            // separate lines, which prettier would otherwise preserve.
            objectWrap: "collapse",
          }),
          "ts",
        );
        if (outputs.metadata != null) {
          markdown.addHeader(3, "Metadata");
          markdown.addCodeBlock(outputs.metadata, "json");
        }
        if (outputs.tsClientEnums != null) {
          markdown.addHeader(3, "TypeScript Enums");
          markdown.addCodeBlock(
            await prettier.format(outputs.tsClientEnums, {
              parser: "typescript",
              objectWrap: "collapse",
            }),
            "ts",
          );
        }

        return ok(markdown);
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
    ): Promise<Result<Markdown, Markdown> | false> => {
      const firstLine = code.split("\n")[0];
      let config: Partial<GratsConfig> = {
        nullableByDefault: true,
        importModuleSpecifierEnding: ".js",
        tsSchemaHeader: null,
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

      const { doc } = schemaResult.value;
      const { tsClientEnums } = parsedOptions.raw.grats;
      // Generate enums file if tsClientEnums is configured
      const enumsPath =
        tsClientEnums == null
          ? undefined
          : path.join(path.dirname(filePath), tsClientEnums);

      const outputs = printOutputs(
        schemaResult.value,
        parsedOptions.raw.grats,
        {
          tsSchema: schemaPath,
          tsClientEnums: enumsPath,
        },
      );

      writeFileSync(schemaPath, nullThrows(outputs.tsSchema));
      if (enumsPath != null) {
        writeFileSync(enumsPath, nullThrows(outputs.tsClientEnums));
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

      const markdown = new Markdown();
      markdown.addHeader(3, "Query Result");
      markdown.addCodeBlock(JSON.stringify(data, null, 2), "json");

      return ok(markdown);
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
