#!/bin/bash

# Exit if any command fails
set -e

# Ensure we are in the website directory
cd "$(dirname "$0")/.."

# Building grats compiles grats-rs/ to WebAssembly, which needs the Rust
# toolchain pinned in grats-rs/rust-toolchain.toml. Install rustup on Netlify
# if its build image doesn't provide it.
if [ -n "$NETLIFY" ] && ! command -v rustup > /dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain none --profile minimal
  . "$HOME/.cargo/env"
fi
(cd ../grats-rs && rustup toolchain install)

# Build grats in the parent directory, using pnpm 
cd ..
pnpm run build
cd website

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