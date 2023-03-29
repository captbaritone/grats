import { fork } from "child_process";
import fetch from "node-fetch";
import assert from "assert";

async function main() {
  const child = fork("./dist/server.js", {
    cwd: "./examples/express-graphql",
    stdio: "pipe",
  });
  try {
    // HACK: Wait for the server to start
    // Not clear why we need two
    await awaitProcessData(child);
    await awaitProcessData(child);
    console.log("Started!");
    const response = await fetch("http://localhost:4000/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query { me { name } }`,
        variables: {},
      }),
    });

    const actual = await response.json();

    assert.deepEqual(actual, { data: { me: { name: "Alice" } } });
    console.log("Success!");
  } finally {
    child.kill("SIGINT");
  }
}

main();

function awaitProcessData(child) {
  return new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      resolve();
    });
  });
}
