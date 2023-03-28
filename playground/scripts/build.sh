!#/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the playground directory
cd "$(dirname "$0")/.."

# Build grats in the parent directory, using pnpm 
cd ..
pnpm build
cd playground

# Build the playground
pnpm build