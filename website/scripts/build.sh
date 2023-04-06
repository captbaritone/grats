!#/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the website directory
cd "$(dirname "$0")/.."

# Build grats in the parent directory, using pnpm 
cd ..
pnpm build
cd website

# Build the website
pnpm build