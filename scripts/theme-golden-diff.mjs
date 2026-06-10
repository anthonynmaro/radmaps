#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import pixelmatch from 'pixelmatch'
import sharp from 'sharp'

function argValue(name, fallback) {
  const prefix = `--${name}=`
  const found = process.argv.find(arg => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function safeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
      env: { ...process.env, ...(options.env ?? {}) },
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`))
    })
  })
}

async function canReach(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return response.ok || response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function startServer(baseUrl) {
  if (await canReach(baseUrl)) return null

  const port = new URL(baseUrl).port || '3000'
  const child = spawn('npm', ['run', 'dev', '--', '--port', port], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  child.stdout.on('data', chunk => process.stdout.write(`[theme-goldens] ${chunk}`))
  child.stderr.on('data', chunk => process.stderr.write(`[theme-goldens] ${chunk}`))

  const started = Date.now()
  while (Date.now() - started < 120_000) {
    if (await canReach(baseUrl)) return child
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  child.kill('SIGTERM')
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

async function imageData(file) {
  const image = sharp(file).ensureAlpha()
  const metadata = await image.metadata()
  const data = await image.raw().toBuffer()
  return {
    data,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  }
}

async function comparePng({ golden, current, diff, label, maxChangedRatio, pixelThreshold }) {
  if (!existsSync(golden)) {
    return { label, pass: false, changedPixels: 0, totalPixels: 0, ratio: 1, reason: `missing golden ${golden}` }
  }
  if (!existsSync(current)) {
    return { label, pass: false, changedPixels: 0, totalPixels: 0, ratio: 1, reason: `missing current ${current}` }
  }

  const expected = await imageData(golden)
  const actual = await imageData(current)
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      label,
      pass: false,
      changedPixels: 0,
      totalPixels: Math.max(expected.width * expected.height, actual.width * actual.height),
      ratio: 1,
      reason: `dimension mismatch ${expected.width}x${expected.height} vs ${actual.width}x${actual.height}`,
    }
  }

  const diffBuffer = Buffer.alloc(expected.width * expected.height * 4)
  const changedPixels = pixelmatch(expected.data, actual.data, diffBuffer, expected.width, expected.height, {
    threshold: pixelThreshold,
    includeAA: false,
  })
  const totalPixels = expected.width * expected.height
  const ratio = totalPixels === 0 ? 1 : changedPixels / totalPixels
  if (changedPixels > 0) {
    await mkdir(path.dirname(diff), { recursive: true })
    await sharp(diffBuffer, {
      raw: { width: expected.width, height: expected.height, channels: 4 },
    }).png().toFile(diff)
  }

  return {
    label,
    pass: ratio <= maxChangedRatio,
    changedPixels,
    totalPixels,
    ratio,
    reason: `${(ratio * 100).toFixed(3)}% changed`,
  }
}

const baseUrl = argValue('base-url', 'http://localhost:3003')
const goldensDir = path.resolve(argValue('goldens', 'docs/theme_goldens'))
const outDir = path.resolve(argValue('out', path.join('/tmp', `radmaps-theme-golden-current-${Date.now()}`)))
const diffDir = path.resolve(argValue('diff-out', path.join(outDir, 'golden-diff')))
const maxChangedRatio = Number.parseFloat(argValue('changed-threshold', '0.005'))
const pixelThreshold = Number.parseFloat(argValue('pixel-threshold', '0.12'))
const manifest = JSON.parse(await readFile(path.resolve('utils/themes/screenshotManifest.json'), 'utf8'))

let server = null
try {
  server = await startServer(baseUrl)
  await run(process.execPath, [
    'scripts/capture-theme-audit.mjs',
    `--base-url=${baseUrl}`,
    `--out=${outDir}`,
    '--skip-owned=1',
  ])

  const results = []
  for (const entry of manifest) {
    const name = `${safeName(entry.themeId)}.png`
    for (const mode of ['editor', 'print']) {
      results.push(await comparePng({
        golden: path.join(goldensDir, 'poster-themes', mode, name),
        current: path.join(outDir, 'poster-themes', mode, name),
        diff: path.join(diffDir, mode, name),
        label: `${entry.themeId}/${mode}`,
        maxChangedRatio,
        pixelThreshold,
      }))
    }
  }

  const failures = results.filter(result => !result.pass)
  for (const result of results) {
    const marker = result.pass ? 'PASS' : 'FAIL'
    console.log(`${marker} ${result.label}: ${result.reason}`)
  }

  if (failures.length) {
    console.error(`Theme golden diff failed for ${failures.length}/${results.length} images. Diff output: ${diffDir}`)
    process.exitCode = 1
  } else {
    console.log(`Theme golden diff passed for ${results.length} images (threshold ${(maxChangedRatio * 100).toFixed(2)}%).`)
  }
} finally {
  if (server) server.kill('SIGTERM')
}
