import { execFileSync } from "child_process";
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

import { binaryPath } from "../../bin/binaryPath.js";

/**
 * Checks that Grats and TypeScript agree about the imports Grats writes.
 *
 * Grats ends the relative imports in its generated schema module with
 * `importModuleSpecifierEnding`, and which endings TypeScript accepts depends
 * on how the project is configured (see `grats::tsconfig_compat`). This runs
 * the combinations against the real compiler and asserts the contract that
 * check promises:
 *
 *   For every combination, `grats --fix` either leaves the project in a state
 *   `tsc` accepts, or reports an error saying why it cannot.
 *
 * Deliberately, nothing here names a TypeScript error code. The check's Rust
 * code encodes beliefs about TS2835, TS5097, TS5096 and TS5109; asserting
 * those same beliefs here would only restate them. Running `tsc` instead
 * means a TypeScript release which changes the rules fails this test, which
 * is when the check needs revisiting.
 *
 * That does tie these expectations to the TypeScript version in the
 * repository, so a TypeScript upgrade may fail this for a reason which is not
 * a Grats regression.
 *
 * Run with `pnpm run test-tsconfig-compat`. Pass `--write` to update the
 * snapshot.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const TSC = path.join(ROOT, "node_modules/.bin/tsc");
const SNAPSHOT = path.join(__dirname, "tsConfigCompat.expected.md");
const GRATS = binaryPath();

/** The TypeScript configurations a project might reasonably have. */
const PROJECTS = [
  {
    name: "node10",
    compilerOptions: { module: "commonjs", moduleResolution: "node10" },
  },
  {
    name: "node16",
    compilerOptions: { module: "node16", moduleResolution: "node16" },
  },
  {
    name: "nodenext",
    compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
  },
  {
    name: "bundler",
    compilerOptions: { module: "preserve", moduleResolution: "bundler" },
  },
  {
    name: "nodenext-noEmit-allowTsExt",
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
      allowImportingTsExtensions: true,
      noEmit: true,
    },
  },
  {
    name: "nodenext-rewrite",
    compilerOptions: {
      module: "nodenext",
      moduleResolution: "nodenext",
      rewriteRelativeImportExtensions: true,
    },
  },
];

/** What Grats might be asked to append to its imports. */
const ENDINGS = ["", ".js", ".ts"];

// Grats colours its diagnostics; strip that to snapshot the text.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

function run(command, args, cwd) {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: stdout.toString() };
  } catch (error) {
    return {
      ok: false,
      output:
        (error.stdout?.toString() ?? "") + (error.stderr?.toString() ?? ""),
    };
  }
}

/**
 * Builds a project, runs `grats --fix` over it, then type checks it.
 *
 * Asserts the contract in both directions:
 *
 * - A combination which already type checks must be left alone: Grats must
 *   not report anything, and `--fix` must not touch `tsconfig.json`.
 * - A combination Grats refuses must genuinely not type check, or Grats is
 *   rejecting a project which would have worked.
 * - Anything Grats accepts must type check afterwards.
 */
function check(project, ending) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grats-tsconfig-compat-"));
  try {
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    // The generated schema module imports `graphql`, so the project needs
    // somewhere to resolve it from.
    fs.symlinkSync(
      path.join(ROOT, "node_modules"),
      path.join(dir, "node_modules"),
      "dir",
    );
    fs.writeFileSync(
      path.join(dir, "src/index.ts"),
      "/** @gqlQueryField */\nexport function greeting(): string {\n  return 'hi';\n}\n",
    );
    const tsconfig = {
      grats: { importModuleSpecifierEnding: ending },
      compilerOptions: {
        strict: true,
        target: "esnext",
        skipLibCheck: true,
        ...project.compilerOptions,
      },
      include: ["src", "schema.ts"],
    };
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2) + "\n",
    );

    // Would this project have type checked as the user configured it?
    const alreadyFine = typeChecks(project, ending);
    const configPath = path.join(dir, "tsconfig.json");
    const before = fs.readFileSync(configPath, "utf-8");

    const grats = run(GRATS, ["--tsconfig", configPath, "--fix"], dir);
    const after = fs.readFileSync(configPath, "utf-8");

    if (alreadyFine) {
      assert.ok(
        grats.ok,
        `\`${ending || "(none)"}\` under \`${project.name}\` already type checks, but Grats rejected it:\n${grats.output}`,
      );
      assert.strictEqual(
        after,
        before,
        `\`${ending || "(none)"}\` under \`${project.name}\` already type checks, but --fix edited tsconfig.json anyway.`,
      );
    }

    if (!grats.ok) {
      // Grats declined, which is allowed as long as it said why. The message
      // is snapshotted so that a change to it is visible.
      const reported = grats.output
        .replace(ANSI, "")
        .split("\n")
        .find((line) => line.includes("error:"));
      assert.ok(
        reported,
        `Grats failed without reporting an error:\n${grats.output}`,
      );
      // The refusal has to be justified, or Grats is rejecting a project
      // which would have worked. `.js` is accepted everywhere, so generate
      // with that and then rewrite the specifier to the ending under test:
      // what Grats would have written had it not refused.
      assert.ok(
        !alreadyFine,
        `Grats rejected \`${ending || "(none)"}\` under \`${project.name}\`, but tsc accepts a schema module written that way, so the refusal is unnecessary.`,
      );
      return {
        outcome: "rejected",
        detail: reported.replace(/^.*- error: /, "").trim(),
      };
    }

    // Grats accepted, so TypeScript must accept what it wrote.
    const tsc = run(TSC, ["-p", dir, "--pretty", "false"], dir);
    assert.ok(
      tsc.ok,
      `Grats accepted \`${ending || "(none)"}\` under \`${project.name}\`, but tsc rejected the schema module it wrote:\n${tsc.output}`,
    );

    if (after === before) {
      return { outcome: "accepted", detail: "left as configured" };
    }
    return { outcome: "fixed", detail: describeEdit(before, after) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** What the fix actually changed, read from the config before and after. */
function describeEdit(before, after) {
  const was = JSON.parse(before);
  const now = JSON.parse(after);
  const changes = [];
  for (const section of ["grats", "compilerOptions"]) {
    for (const [key, value] of Object.entries(now[section] ?? {})) {
      const previous = was[section]?.[key];
      if (previous === value) {
        continue;
      }
      changes.push(
        previous === undefined
          ? `set \`${key}\` to \`${JSON.stringify(value)}\``
          : `changed \`${key}\` to \`${JSON.stringify(value)}\``,
      );
    }
  }
  return changes.length > 0 ? changes.join(", ") : "reformatted";
}

/**
 * Whether `tsc` accepts a schema module whose relative import ends with
 * `ending`. Generated with `.js`, which every configuration accepts, then
 * rewritten, so this reflects what Grats would have emitted.
 */
function typeChecks(project, ending) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grats-tsconfig-would-"));
  try {
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    fs.symlinkSync(
      path.join(ROOT, "node_modules"),
      path.join(dir, "node_modules"),
      "dir",
    );
    fs.writeFileSync(
      path.join(dir, "src/index.ts"),
      "/** @gqlQueryField */\nexport function greeting(): string {\n  return 'hi';\n}\n",
    );
    const write = (grats) =>
      fs.writeFileSync(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            grats,
            compilerOptions: {
              strict: true,
              target: "esnext",
              skipLibCheck: true,
              ...project.compilerOptions,
            },
            include: ["src", "schema.ts"],
          },
          null,
          2,
        ) + "\n",
      );

    write({ importModuleSpecifierEnding: ".js" });
    const generated = run(
      GRATS,
      ["--tsconfig", path.join(dir, "tsconfig.json")],
      dir,
    );
    assert.ok(
      generated.ok,
      `Could not generate with \`.js\`:\n${generated.output}`,
    );

    const schemaPath = path.join(dir, "schema.ts");
    const schema = fs
      .readFileSync(schemaPath, "utf-8")
      .replaceAll('/index.js"', `/index${ending}"`);
    fs.writeFileSync(schemaPath, schema);
    // Put the config back, so the project is configured as the user had it.
    write({ importModuleSpecifierEnding: ending });

    return run(TSC, ["-p", dir, "--pretty", "false"], dir).ok;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  if (GRATS == null || !fs.existsSync(GRATS)) {
    console.error("No Grats binary. Run `pnpm run build:binary` first.");
    process.exit(1);
  }
  const write = process.argv.includes("--write");
  const rows = [];
  for (const project of PROJECTS) {
    for (const ending of ENDINGS) {
      const label = ending === "" ? "(none)" : `\`${ending}\``;
      process.stdout.write(`  ${project.name} + ${label} ... `);
      const { outcome, detail } = check(project, ending);
      console.log(outcome);
      rows.push(`| \`${project.name}\` | ${label} | ${outcome} | ${detail} |`);
    }
  }

  const report =
    [
      "# tsconfig compatibility",
      "",
      "What `grats --fix` does for each combination of TypeScript configuration",
      "and `importModuleSpecifierEnding`, and whether `tsc` then accepts the",
      "generated schema module. Generated by `src/tests/testTsConfigCompat.mjs`.",
      "",
      "Every row was checked against `tsc`. An `accepted` row already type",
      "checked and was left untouched by `--fix`. A `fixed` row did not, and",
      "type checks once the fix is applied. A `rejected` row does not type",
      "check written any way Grats could have written it.",
      "",
      "| TypeScript config | Configured ending | Outcome | Detail |",
      "| --- | --- | --- | --- |",
      ...rows,
    ].join("\n") + "\n";

  if (write) {
    fs.writeFileSync(SNAPSHOT, report);
    console.log(`\nWrote ${path.relative(ROOT, SNAPSHOT)}`);
    return;
  }
  const expected = fs.existsSync(SNAPSHOT)
    ? fs.readFileSync(SNAPSHOT, "utf-8")
    : "";
  if (expected !== report) {
    console.error(
      `\n${path.relative(ROOT, SNAPSHOT)} is out of date. Re-run with --write to update it.\n`,
    );
    console.error(report);
    process.exit(1);
  }
  console.log("\nAll combinations match the snapshot.");
}

main();
