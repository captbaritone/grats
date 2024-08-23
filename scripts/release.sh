#!/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the website directory
cd "$(dirname "$0")/.."

pnpm i
pnpm run build
pnpm version patch # or minor or major
pnpm publish
git push --tags
git push origin