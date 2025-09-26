## Workers

We need a version of the TypeScript language service worker that matches the version of TypeScript we are using in Grats.

Monaco comes built in with an older version of TypeScript, so we need to get a newer one.

The TypeScript playground builds different versions of the TypeScript worker from different versions of TypeScript. They use an AMD module format, which is not compatible with our ES module setup. Luckily they also build the ES module version of the worker.

I was able to infer the URL for the worker from the URLs used in their playground and some observations about the Monaco editor package structure. You can swap the version number in the URL to get different versions of the worker.

```
https://playgroundcdn.typescriptlang.org/cdn/5.9.2/monaco/esm/vs/language/typescript/ts.worker.js
```

However, we need it to also use the instance of `initialize()` from our version of Monaco, so we need to copy the file locally and modify it slightly. Luckily the import is near the top of the massive file.

```typescript
// import { initialize } from "../../editor/editor.worker.js";
import { initialize } from "monaco-editor/esm/vs/editor/editor.worker.js";
```
