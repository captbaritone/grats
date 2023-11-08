!#/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the website directory
cd "$(dirname "$0")/.."

# Build grats in the parent directory, using pnpm 
cd ..
pnpm build
cd website

# Rebuild/validate the grats code used in the website
pnpm grats
# Error if any of these changes have not been committed
git diff --exit-code --quiet || (echo "Uncommitted changes detected." && exit 1)

# Build the website
pnpm build