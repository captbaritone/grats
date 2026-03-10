#!/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the website directory
cd "$(dirname "$0")/.."

# Build grats in the parent directory, using pnpm 
cd ..
pnpm run build
cd website

# Rebuild/validate the grats code used in the website
pnpm run grats
# Error if any of these changes have not been committed
git diff --exit-code || (echo "Uncommitted changes detected." && exit 1)

# Delete llm-docs/ before build so removed pages are detected
rm -rf ../llm-docs

# Build the website (also regenerates llm-docs/ via docs-export plugin)
pnpm run build

# Verify generated llm-docs/ are up to date
cd ..
if [ -n "$(git status --porcelain llm-docs/)" ]; then
  echo "llm-docs/ are out of date. Run 'cd website && pnpm run build' and commit the changes."
  git status --porcelain llm-docs/
  git diff llm-docs/
  exit 1
fi