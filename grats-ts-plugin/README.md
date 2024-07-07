# grats-ts-plugin

Experimental TypeScript plugin for Grats. This plugin is not ready for production use. Currently it reports a subset of Grats errors (those that can be detected syntactically based on a single file) and provides code actions to fix some of these errors.

## Installation

For those interested in trying this extension out, here's how to install it:

### Install the plugin

```
npm install -D grats-ts-plugin
```

### Update `tsconfig.json`

```
{
    "compilerOptions": {
      "plugins": [{
        "name": "grats-ts-plugin"
      }]
    }
  }
```

### Configure TypeScript version used by VSCode:

- `cmd+shift+p`
- "TypeScript: Select TypeScript Version"
- "Use Workspace Version"

This will create a VSCode settings file like this:

```
{
    "typescript.tsdk": "node_modules/typescript/lib"
}
```
