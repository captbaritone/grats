import { readFile } from "fs/promises";
import { extract } from "./extract";

main();

async function main() {
  const code = await readFile("TweetResolver.ts", "utf8");
  console.log(extract(code));
}
