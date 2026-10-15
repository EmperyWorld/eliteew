#!/usr/bin/env node
/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Run ESLint while resolving typescript to typescript@6 (alias ts-for-eslint).
 * Project typescript stays at 7.x for next build / tsc; typescript-eslint@8
 * still hard-rejects TypeScript 7 at load time.
 *
 * Invariants:
 * - Only used by pnpm lint; does not change Node resolution for Next builds.
 * - Lives at package root (repo gitignore blocks nested scripts dirs).
 *
 * Related:
 * - shared/web/site_prod/eslint.config.mjs
 * - documentation/product/SITE-PROD-LANDING.md (toolchain)
 */

"use strict";

const Module = require("node:module");
const path = require("node:path");

const ts6Entry = require.resolve("ts-for-eslint");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "typescript") {
    return ts6Entry;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const eslintBin = path.join(
  path.dirname(require.resolve("eslint/package.json")),
  "bin",
  "eslint.js",
);
process.argv.splice(1, 1, eslintBin);
require(process.argv[1]);
