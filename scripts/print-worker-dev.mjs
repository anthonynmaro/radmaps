#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

function readEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    value = value.replace(/\s+#.*$/, '')
    value = value.replace(/^['"]|['"]$/g, '')
    out[match[1]] = value
  }
  return out
}

const rootEnv = readEnv('.env')
const workerEnv = readEnv('render-worker-v4/.env')
const env = {
  ...rootEnv,
  ...workerEnv,
  ...process.env,
}

env.APP_URL ||= env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001'

const workerDir = resolve('render-worker-v4')
const child = spawn('npx', ['tsx', '--watch', 'queue.ts'], {
  cwd: workerDir,
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
