"use strict";

// TypeScript is vary particular about how plugins are structured. They must be
// CommonJS and they must have a single value for `module.exports`. Additionally,
// the plugin must be a plain module name (no `/` characters allowed).
//
// However, the logic for the plugin is tightly coupled with Grats itself and
// should really live (and ship) alongside each version of Grats. While
// I continue to struggle with figuring out how to let Grats operate as its own
// TypeScript plugin, this package is just a shim.
module.exports = require("grats").initTsPlugin;
