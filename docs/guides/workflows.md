# Workflows

This document includes some advice on how to setup your project and processes to
make the most of Grats.

## Make it easy to run Grats

We recommend that you add a `grats` script to your project's `package.json`.

```json
{
  "scripts": {
    "grats": "grats --output=schema.graphql"
  }
}
```

This way any contributor can regenerate the schema by running `npm run grats`.

## Check in your schema

We recommend that you include Grats' generated schema in your repository. This
approach has several advantages:

1. You can easily see the changes to your schema during code reviews.
2. Manually inspecing the schema is as simple as opening a file.
3. Other tools, such as GraphiQL, client codegen, and editor integrations can easily access the schema.

## Continuous integration

To ensure that your code base does not get into a state where Grats cannot
extract types due to errors, and that your schema file always matches your
implementation, we recommend that you add a CI step that runs Grats and ensures
that the schema maches the checked in version.

Here's what an example script might look like:

```bash
#!/bin/bash

# Exit if any command fails
set -e

# Run Grats
npm run grats

# Check that it didn't change anything
if [ -n "$(git status --porcelain)" ]; then
    echo "Schema file is out of date. Please run 'npm run grats' and commit the changes."
    git diff
    exit 1
fi
```
