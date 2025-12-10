## input

```json title="multiLineNonHeader.invalid.json"
{
  "tsSchema": ["/path/", "to/", "schema.ts"]
}
```

## Output

### Error Report

```text
error: Expected property `tsSchema` to be a string, but got ["/path/","to/","schema.ts"].
```