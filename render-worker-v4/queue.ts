// render-worker-v4/queue.ts
//
// Print queue consumer entry point. It claims final-print jobs from Postgres,
// calls the configured renderer, validates/uploads the artifact, and submits
// Gelato orders.
//
// Graceful shutdown:
//   • SIGINT / SIGTERM → AbortController → consumer loop drains.
//   • Pool is end()ed before the process exits.

import { runConsumer } from './src/queue/consumer.js'
import { shutdownDb } from './src/db.js'
import { log } from './src/log.js'

async function main(): Promise<void> {
  const controller = new AbortController()

  const handleSignal = (sig: string) => {
    log.info('print_queue_signal', { signal: sig })
    controller.abort()
  }
  process.on('SIGINT', () => handleSignal('SIGINT'))
  process.on('SIGTERM', () => handleSignal('SIGTERM'))

  try {
    await runConsumer({ signal: controller.signal })
    await shutdownDb()
    process.exit(0)
  } catch (err) {
    log.error('print_queue_fatal', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    await shutdownDb().catch(() => {})
    process.exit(1)
  }
}

main()
