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
error: Invalid Grats config: tsSchema: invalid type: sequence, expected a string
```