# multiLineNonHeader.invalid.json

## Input

```json title="multiLineNonHeader.invalid.json"
{
  "tsSchema": ["/path/", "to/", "schema.ts"]
}
```

## Output

### Error Report

```text
config.json:2:3 - error: Invalid Grats config: tsSchema: invalid type: sequence, expected a string

2   "tsSchema": ["/path/", "to/", "schema.ts"]
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```