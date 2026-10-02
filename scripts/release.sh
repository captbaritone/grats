#!/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the website directory
cd "$(dirname "$0")/.."

pnpm i
pnpm version patch # or minor or major
# CI publishes the tagged version, with the binary for every platform.
git push --tags
git push origin