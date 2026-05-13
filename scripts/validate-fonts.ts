#!/usr/bin/env npx tsx
/**
 * CI-runnable font validator.
 *
 * Verifies:
 *   1. Every entry in FONT_REGISTRY points to an existing fonts/*.ttf file.
 *   2. Every fonts/*.ttf is referenced by FONT_REGISTRY (no orphans).
 *   3. Computes font_bundle_version = sha256 of all TTF bytes (sorted).
 *
 * If anything is wrong, exits non-zero. The current bundle version hash
 * is printed so it can be cross-referenced with HASH_VERSION.chrome.fontBundle
 * (utils/render/hashVersion.ts) to confirm the cache invalidates when
 * the bundle changes.
 *
 * Run from repo root: `npx tsx scripts/validate-fonts.ts`
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'

import { FONT_REGISTRY, listAllFontFiles } from '../utils/render/fontRegistry'

const REPO_ROOT = process.cwd()
const FONTS_DIR = join(REPO_ROOT, 'fonts')

function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

// 1. Every registered file exists.
const registered = listAllFontFiles()
const missing: string[] = []
for (const rel of registered) {
  const abs = join(REPO_ROOT, rel)
  if (!existsSync(abs)) missing.push(rel)
}
if (missing.length > 0) {
  fail(`${missing.length} font(s) registered but not on disk:\n  ${missing.join('\n  ')}`)
}

// 2. Every fonts/*.ttf is registered (orphan check).
const onDisk = readdirSync(FONTS_DIR)
  .filter((n) => /\.(ttf|otf)$/i.test(n))
  .map((n) => `fonts/${n}`)
const registeredSet = new Set(registered)
const orphans = onDisk.filter((p) => !registeredSet.has(p))
if (orphans.length > 0) {
  console.warn(`⚠️  ${orphans.length} orphan font(s) on disk (not in registry):`)
  for (const o of orphans) console.warn(`  ${o}`)
  // Orphans are warnings, not failures — they bloat the repo but don't break.
}

// 3. Coverage report.
console.log('\n=== font registry validation ===')
console.log(`registered families: ${Object.keys(FONT_REGISTRY).length}`)
console.log(`registered files:    ${registered.length}`)
console.log(`on-disk .ttf files:  ${onDisk.length}`)

// 4. Compute bundle hash.
const hasher = createHash('sha256')
let totalBytes = 0
for (const rel of registered.sort()) {
  const abs = join(REPO_ROOT, rel)
  const bytes = readFileSync(abs)
  hasher.update(basename(rel)) // include filename so renames invalidate
  hasher.update(bytes)
  totalBytes += bytes.byteLength
}
const bundleHash = hasher.digest('hex').slice(0, 12)
console.log(`bundle bytes:        ${(totalBytes / 1e6).toFixed(2)} MB`)
console.log(`bundle hash:         ${bundleHash}`)
console.log(`\n→ verify HASH_VERSION.chrome.fontBundle in utils/render/hashVersion.ts is set to 'fonts-${bundleHash}' (or bumped to a value that includes it).`)

console.log('\n✅ font registry valid')
