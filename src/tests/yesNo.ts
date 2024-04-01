// Adapted from https://github.com/tcql/node-yesno/blob/master/yesno.js

import * as readline from "readline";

const options = {
  yes: ["yes", "y"],
  no: ["no", "n"],
};

export async function ask(question: string): Promise<boolean> {
  const yValues = options.yes.map((v) => v.toLowerCase());
  const nValues = options.no.map((v) => v.toLowerCase());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(function (resolve) {
    rl.question(question + " ", async function (answer) {
      rl.close();

      const cleaned = answer.trim().toLowerCase();

      if (yValues.indexOf(cleaned) >= 0) return resolve(true);

      if (nValues.indexOf(cleaned) >= 0) return resolve(false);

      process.stdout.write("\nInvalid Response.\n");
      process.stdout.write(
        "Answer either yes : (" + yValues.join(", ") + ") \n",
      );
      process.stdout.write("Or no: (" + nValues.join(", ") + ") \n\n");
      const result = await ask(question);
      resolve(result);
    });
  });
}
