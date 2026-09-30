export function tsConfigNotFound(cwd: string) {
  return `Grats: Could not find \`tsconfig.json\` searching in ${cwd}.\n\nSee https://www.typescriptlang.org/download/ for instructors on how to add TypeScript to your project. Then run \`npx tsc --init\` to create a \`tsconfig.json\` file.`;
}
