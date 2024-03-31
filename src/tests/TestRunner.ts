import * as fs from "fs";
import * as path from "path";
import { diff } from "jest-diff";
import { ask } from "./yesNo";

type Transformer = (
  code: string,
  filename: string,
) => Promise<string | false> | (string | false);

/**
 * Looks in a fixtures dir for .ts files, transforms them according to the
 * passed transformer, and compares the output to the expected output in the
 * `.expected` file.
 */
export default class TestRunner {
  _write: boolean;
  _fixturesDir: string;
  _testFixtures: string[] = [];
  _otherFiles: Set<string> = new Set();
  _skip: Set<string> = new Set();
  _failureCount = 0;
  _transformer: Transformer;

  constructor(
    fixturesDir: string,
    write: boolean,
    filter: string | null,
    testFilePattern: RegExp,
    ignoreFilePattern: RegExp | null,
    transformer: Transformer,
  ) {
    this._write = write;
    this._fixturesDir = fixturesDir;
    this._transformer = transformer;
    const filterRegex = filter != null ? new RegExp(filter) : null;
    for (const fileName of readdirSyncRecursive(fixturesDir)) {
      if (testFilePattern.test(fileName)) {
        this._testFixtures.push(fileName);
        const filePath = path.join(fixturesDir, fileName);
        if (filterRegex != null && !filePath.match(filterRegex)) {
          this._skip.add(fileName);
        }
      } else if (!ignoreFilePattern || !ignoreFilePattern.test(fileName)) {
        this._otherFiles.add(fileName);
      }
    }
  }

  // Returns true if the test passed
  async run({ interactive }: { interactive: boolean }): Promise<boolean> {
    for (const fixture of this._testFixtures) {
      await this._testFixture(fixture, { interactive });
    }
    console.log("");

    if (this._failureCount > 0) {
      console.log(
        `${this._failureCount} failures found. Run with --write to update fixtures`,
      );
      return false;
    } else {
      console.log("All tests passed!");
    }

    if (this._otherFiles.size > 0) {
      if (this._write) {
        for (const fileName of this._otherFiles) {
          console.log("DELETED: " + fileName);
          fs.unlinkSync(path.join(this._fixturesDir, fileName));
        }
      } else {
        console.log("Unexpected files found:");
        for (const fileName of this._otherFiles) {
          console.log(" - " + fileName);
        }
        console.log("Run with --write to deleted unexpected files");
        return false;
      }
    }
    return true;
  }

  async _testFixture(
    fixture: string,
    { interactive }: { interactive: boolean },
  ) {
    const expectedFileName = fixture + ".expected";
    const expectedFilePath = path.join(this._fixturesDir, expectedFileName);
    if (this._otherFiles.has(expectedFileName)) {
      this._otherFiles.delete(expectedFileName);
    } else {
      fs.writeFileSync(expectedFilePath, "", "utf-8");
    }
    if (this._skip.has(fixture)) {
      return;
    }

    const fixturePath = path.join(this._fixturesDir, fixture);
    const displayName = path.relative(this._fixturesDir, fixturePath);
    const expectedContent = fs.readFileSync(expectedFilePath, "utf-8");

    const fixtureContent = fs.readFileSync(fixturePath, "utf-8");

    const actual = await this.transform(fixtureContent, fixture);
    if (actual === false) {
      console.error("SKIPPING: " + displayName);
      this._skip.add(fixture);
      return;
    }

    const actualOutput = `-----------------
INPUT
----------------- 
${fixtureContent}
-----------------
OUTPUT
-----------------
${actual}`;

    if (actualOutput !== expectedContent) {
      if (interactive) {
        console.error("FAILURE: " + displayName);
        console.log(diff(expectedContent, actualOutput));
        console.log("Fixture did not match.");
        console.log(
          `(You can rerun just this test with: \`pnpm run test --filter=${fixture}\`)`,
        );
        const write = await ask(
          "Would you like to update this fixture file? (y/n)",
        );
        if (write) {
          console.error("UPDATED: " + displayName);
          fs.writeFileSync(expectedFilePath, actualOutput, "utf-8");
        } else {
          this._failureCount++;
        }
      } else if (this._write) {
        console.error("UPDATED: " + displayName);
        fs.writeFileSync(expectedFilePath, actualOutput, "utf-8");
      } else {
        this._failureCount++;
        console.error("FAILURE: " + displayName);
        console.log(diff(expectedContent, actualOutput));
      }
    } else {
      console.log("OK: " + displayName);
    }
  }

  async transform(code: string, filename: string): Promise<string | false> {
    try {
      return await this._transformer(code, filename);
    } catch (e) {
      console.error(e);
      return e.message;
    }
  }
}

function readdirSyncRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      for (const f of readdirSyncRecursive(filePath)) {
        files.push(path.join(file, f));
      }
    } else {
      files.push(file);
    }
  }
  return files;
}
