/**
 * Tests of the WebAssembly build of Grats, as the playground uses it. Run
 * with `pnpm run test:wasm`, which builds it first.
 */

import { before, describe, test } from "node:test";
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { CompileRequest, Compiled, Diagnostic, Grats } from "./grats";

const REPO_ROOT = path.join(__dirname, "../../..");
const WASM_PATH = path.join(
  REPO_ROOT,
  "grats-rs/target/wasm32-unknown-unknown/release/grats_wasm.wasm",
);

/** The `grats` package, as the playground provides it. */
const GRATS_PACKAGE = {
  "/node_modules/grats/package.json": JSON.stringify({
    name: "grats",
    types: "src/index.ts",
  }),
  "/node_modules/grats/src/index.ts": readRepoFile("src/index.ts"),
  "/node_modules/grats/src/Types.ts": readRepoFile("src/Types.ts"),
};

/** Keeps the outputs short. */
const NO_HEADERS = {
  schemaHeader: null,
  tsSchemaHeader: null,
  tsClientEnumsHeader: null,
};

let grats: Grats;

before(async () => {
  grats = await Grats.load(readFileSync(WASM_PATH));
});

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function compile(
  code: string,
  config: CompileRequest["config"] = NO_HEADERS,
): ReturnType<Grats["compile"]> {
  return grats.compile({
    files: { ...GRATS_PACKAGE, "/index.ts": code },
    rootNames: ["/index.ts"],
    config,
  });
}

function expectCompiled(result: ReturnType<Grats["compile"]>): Compiled {
  if (result.kind === "ERROR") {
    assert.fail(result.err.map((d) => d.formatted).join("\n"));
  }
  return result.value;
}

function expectDiagnostics(result: ReturnType<Grats["compile"]>): Diagnostic[] {
  if (result.kind === "OK") {
    assert.fail("Expected diagnostics");
  }
  return result.err;
}

/** The text which a diagnostic's location spans. */
function spannedText(code: string, diagnostic: Diagnostic): string {
  const { location } = diagnostic;
  assert.ok(location);
  assert.equal(location.fileName, "/index.ts");
  return code.slice(location.start, location.start + location.length);
}

describe("compile", () => {
  test("prints the schema", () => {
    const { outputs, warnings } = expectCompiled(
      compile(`
        import { Int } from "grats";

        /** @gqlQueryField */
        export function count(): Int {
          return 1;
        }
      `),
    );
    assert.equal(outputs.graphqlSchema, "type Query {\n  count: Int\n}\n");
    assert.match(
      outputs.tsSchema,
      /import \{ count as queryCountResolver \} from "\.\/index";/,
    );
    assert.equal(outputs.tsClientEnums, undefined);
    assert.equal(outputs.metadata, undefined);
    assert.deepEqual(warnings, []);
  });

  test("prints the outputs the config asks for", () => {
    const { outputs, warnings } = expectCompiled(
      compile(
        `
          /** @gqlEnum */
          export enum Color {
            RED = "RED",
          }

          /** @gqlQueryField */
          export function color(): Color {
            return Color.RED;
          }
        `,
        {
          ...NO_HEADERS,
          nullableByDefault: false,
          tsSchema: "./generated/schema.ts",
          tsClientEnums: "./generated/enums.ts",
          importModuleSpecifierEnding: ".js",
          EXPERIMENTAL__emitMetadata: true,
          EXPERIMENTAL__emitResolverMap: true,
        },
      ),
    );
    assert.equal(
      outputs.graphqlSchema,
      "enum Color {\n  RED\n}\n\ntype Query {\n  color: Color!\n}\n",
    );
    // Imports are relative to the outputs' paths.
    assert.match(outputs.tsSchema, /export function getResolverMap\(\)/);
    assert.match(outputs.tsSchema, /from "\.\/\.\.\/index\.js";/);
    assert.match(outputs.tsClientEnums ?? "", /from "\.\/\.\.\/index\.js";/);
    assert.deepEqual(
      JSON.parse(outputs.metadata ?? "").types.Query.color.resolver,
      {
        kind: "function",
        path: "index.ts",
        exportName: "color",
        arguments: [],
      },
    );
    assert.deepEqual(warnings, [
      "Grats: The `EXPERIMENTAL__emitMetadata` option is experimental and will be renamed or removed in a future release.",
      "Grats: The `EXPERIMENTAL__emitResolverMap` option is experimental and will be renamed or removed in a future release.",
    ]);
  });

  test("prints headers", () => {
    const { outputs } = expectCompiled(
      compile(
        `
          /** @gqlQueryField */
          export function hello(): string {
            return "Hello";
          }
        `,
        { schemaHeader: ["# One", "# Two"] },
      ),
    );
    assert.equal(
      outputs.graphqlSchema,
      "# One\n# Two\n\ntype Query {\n  hello: String\n}\n",
    );
    assert.match(outputs.tsSchema, /^\/\*\*\n \* Executable schema generated/);
  });

  test("reports diagnostics with their locations", () => {
    // The emoji is two UTF-16 code units.
    const code = `
      // 🎉
      /** @gqlType */
      export class User {
        /** @gqlField */
        name(): Unknown {
          return "Alice";
        }
      }
    `;
    const [diagnostic, ...rest] = expectDiagnostics(compile(code));
    assert.deepEqual(rest, []);
    assert.equal(spannedText(code, diagnostic), "Unknown");
    assert.match(diagnostic.message, /Unable to resolve type reference/);
    assert.equal(diagnostic.fix, null);
    assert.deepEqual(diagnostic.relatedInformation, []);
    assert.ok(
      diagnostic.formatted.startsWith(
        `index.ts:6:17 - error: ${diagnostic.message}\n`,
      ),
      diagnostic.formatted,
    );
    assert.ok(!diagnostic.formatted.includes("\x1b"), "Expected no color");
  });

  test("reports related information", () => {
    const code = `
      /** @gqlType */
      export class User {
        /** @gqlField */
        name: string;
      }

      /** @gqlType User */
      export class OtherUser {
        /** @gqlField */
        id: string;
      }
    `;
    const [diagnostic] = expectDiagnostics(compile(code));
    assert.equal(
      diagnostic.message,
      'There can be only one type named "User".',
    );
    assert.equal(spannedText(code, diagnostic), "User");
    const [related] = diagnostic.relatedInformation;
    assert.equal(related.message, "Related location");
    const { fileName, start, length } = related.location;
    assert.equal(fileName, "/index.ts");
    assert.equal(code.slice(start, start + length), "User");
    assert.ok(start > code.indexOf("@gqlType User"));
  });

  test("reports fixes", () => {
    const code = `
      /** @gqlQueryField */
      function hello(): string {
        return "Hello";
      }
    `;
    const [diagnostic] = expectDiagnostics(compile(code));
    assert.equal(spannedText(code, diagnostic), "hello");
    assert.deepEqual(diagnostic.fix, {
      fixName: "add-export-keyword-to-function",
      description: "Add export keyword to function with @gqlField",
      changes: [
        {
          fileName: "/index.ts",
          textChanges: [
            {
              span: { start: code.indexOf("function hello"), length: 0 },
              newText: "export ",
            },
          ],
        },
      ],
    });
  });

  test("reports an invalid config", () => {
    const [diagnostic, ...rest] = expectDiagnostics(
      compile("", { nullableByDefault: "yes" }),
    );
    assert.deepEqual(rest, []);
    assert.equal(diagnostic.location, null);
    assert.match(
      diagnostic.message,
      /^Invalid Grats config: nullableByDefault: invalid type/,
    );
    assert.equal(diagnostic.formatted, `error: ${diagnostic.message}\n`);
  });

  test("recovers from a crash", () => {
    assert.throws(
      () => grats.compile({} as CompileRequest),
      /^Error: Grats internal error in `compile`: .*Input should be a CompileRequest/s,
    );
    expectCompiled(
      compile(`
        /** @gqlQueryField */
        export function hello(): string {
          return "Hello";
        }
      `),
    );
  });
});
