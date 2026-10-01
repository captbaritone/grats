import * as path from "path";
import { fileURLToPath } from "url";
import TestRunner, { Transformer } from "./TestRunner.js";
import { buildSchemaAndDocResult } from "../lib.js";
import { buildSchema, graphql, GraphQLSchema, printSchema } from "graphql";
import { Command } from "commander";
import { ReportableDiagnostics } from "../utils/DiagnosticError.js";
import { writeFileSync } from "fs";
import { diff } from "jest-diff";
import { GratsConfig } from "../gratsConfig.js";
import { projectFromFiles, validateGratsOptions } from "../rs/project.js";
import { SEMANTIC_NON_NULL_DIRECTIVE } from "../publicDirectives.js";
import { printOutputs } from "../printSchema.js";
import { nullThrows } from "../utils/helpers.js";
import { Result, ok } from "../utils/Result.js";
import { writeTypeScriptTypeToDisk } from "../../scripts/buildConfigTypes.js";
import { Markdown } from "./Markdown.js";

writeTypeScriptTypeToDisk();

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

const integrationFixturesDir = path.join(__dirname, "integrationFixtures");

type TestDir = {
  fixturesDir: string;
  testFilePattern: RegExp;
  ignoreFilePattern: RegExp | null;
  transformer: Transformer;
};

const testDirs: TestDir[] = [
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
      const parsedOptionsResult = validateGratsOptions(config);
      if (parsedOptionsResult.kind === "ERROR") {
        // We don't expect integration tests to error during config parsing
        // so we throw here instead of returning a Markdown result.
        throw new Error(
          ReportableDiagnostics.fromDiagnostics(
            parsedOptionsResult.err,
          ).formatDiagnosticsWithContext(),
        );
      }
      const project = projectFromFiles(files, parsedOptionsResult.value);
      const schemaResult = buildSchemaAndDocResult(project);
      if (schemaResult.kind === "ERROR") {
        // We don't expect integration tests to error GraphQL schema building
        // so we throw here instead of returning a Markdown result.
        throw new Error(
          ReportableDiagnostics.fromDiagnostics(
            schemaResult.err,
          ).formatDiagnosticsWithContext(),
        );
      }

      const { tsClientEnums } = project.config;
      // Generate enums file if tsClientEnums is configured
      const enumsPath =
        tsClientEnums == null
          ? undefined
          : path.join(path.dirname(filePath), tsClientEnums);

      const outputs = printOutputs(schemaResult.value, project.config, {
        graphqlSchema: true,
        tsSchema: schemaPath,
        tsClientEnums: enumsPath,
      });

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

      const schemaDiff = compareSchemas(
        actualSchema,
        buildSchema(nullThrows(outputs.graphqlSchema)),
      );

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

program.parse();
