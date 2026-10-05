# removedOption.invalid.json

## Input

```json title="removedOption.invalid.json"
{
  "reportTypeScriptTypeErrors": true
}
```

## Output

### Error Report

```text
config.json:2:3 - error: The Grats config option `reportTypeScriptTypeErrors` has been removed. Grats no longer type checks your code. Run `tsc` to report TypeScript type errors.

2   "reportTypeScriptTypeErrors": true
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```