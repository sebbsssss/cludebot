#!/usr/bin/env node
/**
 * build-publish.mjs — Produce the root-level `dist/` used for `npm publish`.
 *
 * After the monorepo refactor, the brain's compiled output lives at
 * packages/brain/dist/ and imports `@clude/shared` via workspace. That can't
 * be published directly because `@clude/shared` isn't on npm.
 *
 * This script uses esbuild to produce a self-contained bundle at repo root:
 *   dist/cli/index.js       — the `clude` CLI binary
 *   dist/sdk/index.js       — the `Cortex` SDK exported as the package main
 *   dist/mcp/server.js      — the MCP server (exports["./mcp"])
 *   dist/mcp/local-store.js — the local MCP store (exports["./local"])
 *
 * Workspace packages (`@clude/*`) are inlined. All declared npm deps in
 * packages/brain and packages/shared are kept external so users' package
 * managers resolve them.
 */

import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function readDeps(pkgRelPath) {
  const p = path.join(repoRoot, pkgRelPath);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    ...(j.dependencies ?? {}),
    ...(j.peerDependencies ?? {}),
    ...(j.optionalDependencies ?? {}),
  };
}

// Everything the bundled code might require at runtime. Treat any @clude/*
// as internal (will be inlined); everything else external so users resolve it.
const allDeps = {
  ...readDeps('package.json'),
  ...readDeps('packages/brain/package.json'),
  ...readDeps('packages/shared/package.json'),
};
const externals = Object.keys(allDeps).filter((name) => !name.startsWith('@clude/'));

// Each CLI entry's shebang in the source is preserved automatically by esbuild —
// no banner needed (adding one duplicates the shebang and crashes the binary).
const entries = [
  { in: 'packages/brain/src/cli/index.ts',      out: 'dist/cli/index.js'      },
  { in: 'packages/brain/src/sdk/index.ts',      out: 'dist/sdk/index.js'      },
  { in: 'packages/brain/src/mcp/server.ts',     out: 'dist/mcp/server.js'     },
  { in: 'packages/brain/src/mcp/local-store.ts',out: 'dist/mcp/local-store.js'},
];

// Clean previous output
const distDir = path.join(repoRoot, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });

for (const { in: entryPoint, out } of entries) {
  const entryAbs = path.join(repoRoot, entryPoint);
  if (!fs.existsSync(entryAbs)) {
    throw new Error(`entry missing: ${entryPoint}`);
  }
  await esbuild.build({
    entryPoints: [entryAbs],
    outfile: path.join(repoRoot, out),
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: externals,
    sourcemap: false,
    logLevel: 'info',
    loader: { '.node': 'file' },
  });
  console.log(`✓ built ${out}`);
}

// Make CLI executable
fs.chmodSync(path.join(repoRoot, 'dist/cli/index.js'), 0o755);

// Copy supabase schema to root so exports["./schema"] resolves
const schemaSrc = path.join(repoRoot, 'packages/database/supabase-schema.sql');
const schemaDst = path.join(repoRoot, 'supabase-schema.sql');
if (fs.existsSync(schemaSrc)) {
  fs.copyFileSync(schemaSrc, schemaDst);
  console.log('✓ copied supabase-schema.sql to root');
}

console.log('\nbuild-publish complete.');
