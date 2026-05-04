// render-worker-v4/queue.ts
//
// Print queue consumer entry point. Run with `node queue.js` (or `tsx
// queue.ts` in dev). This is intentionally a separate process from the
// Express HTTP server in `index.ts` — see processJob.ts for the rationale
// (process isolation around long, OOM-prone Native renders).
//
// In single-process deployments the HTTP server can be started in this
// same Node program by setting PRINT_WORKER_HTTP=embedded — but the
// default is "queue only", paired with a separate Railway service that
// runs `node index.js`.
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
