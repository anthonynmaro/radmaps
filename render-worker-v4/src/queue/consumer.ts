// render-worker-v4/src/queue/consumer.ts
//
// Polling loop that claims `print_render_jobs` rows via
// SELECT … FOR UPDATE SKIP LOCKED, dispatches each to processJob(), and
// loops until SIGINT/SIGTERM.
//
// Concurrency: env PRINT_WORKER_CONCURRENCY (default 1). For >1, we run
// N independent claim-and-process slots in parallel. Each slot owns its
// own pg client for the duration of the claim transaction; the actual
// processJob run happens after COMMIT, so a slow render never blocks
// other slots from claiming new jobs.
//
// Sleep between empty polls: PRINT_WORKER_POLL_MS (default 2000ms).

import { hostname } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'

import { getPgPool, withPgClient } from '../db.js'
import { log } from '../log.js'

import { processJob, type PrintRenderJobRow } from './processJob.js'

interface ConsumerOptions {
  concurrency?: number
  pollMs?: number
  workerId?: string
  /**
   * Stop signal — when this resolves, the loop drains current work and
   * exits. The default wires it up to SIGINT/SIGTERM in queue.ts.
   */
  signal?: AbortSignal
}

function resolveOptions(opts: ConsumerOptions): Required<Omit<ConsumerOptions, 'signal'>> & {
  signal: AbortSignal | undefined
} {
  const concurrency = opts.concurrency ?? (Number(process.env.PRINT_WORKER_CONCURRENCY ?? '1') || 1)
  const pollMs = opts.pollMs ?? (Number(process.env.PRINT_WORKER_POLL_MS ?? '2000') || 2000)
  const workerId = opts.workerId ?? `${hostname()}/${process.pid}`
  return { concurrency, pollMs, workerId, signal: opts.signal }
}

/**
 * Claim a single queued job in its own transaction. Returns the claimed
 * row (with attempts already incremented and status='rendering'), or
 * null if the queue is empty.
 *
 * Exported so tests can drive a real DB if needed.
 */
export async function claimNextJob(workerId: string): Promise<PrintRenderJobRow | null> {
  return withPgClient(async (client) => {
    await client.query('BEGIN')
    try {
      const { rows } = await client.query<PrintRenderJobRow>(
        `SELECT id, stripe_session_id, print_hash, status, attempts, max_attempts,
                last_error, worker_id, claimed_at, completed_at, created_at, updated_at
           FROM print_render_jobs
          WHERE status = 'queued'
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1`,
      )
      if (rows.length === 0) {
        await client.query('COMMIT')
        return null
      }
      const job = rows[0]
      const updated = await client.query<PrintRenderJobRow>(
        `UPDATE print_render_jobs
            SET status = 'rendering',
                worker_id = $1,
                claimed_at = now(),
                attempts = attempts + 1,
                last_error = NULL
          WHERE id = $2
          RETURNING id, stripe_session_id, print_hash, status, attempts, max_attempts,
                    last_error, worker_id, claimed_at, completed_at, created_at, updated_at`,
        [workerId, job.id],
      )
      await client.query('COMMIT')
      return updated.rows[0] ?? null
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    }
  })
}

/**
 * One slot's work loop. Repeatedly: claim → process → repeat. When no
 * job is available, sleep pollMs.
 */
async function runSlot(
  slotId: number,
  opts: Required<Omit<ConsumerOptions, 'signal'>> & { signal: AbortSignal | undefined },
): Promise<void> {
  const { workerId, pollMs, signal } = opts
  while (!signal?.aborted) {
    let job: PrintRenderJobRow | null = null
    try {
      job = await claimNextJob(workerId)
    } catch (err) {
      // Don't tight-loop on a DB outage — log and back off.
      log.error('print_queue_claim_error', {
        slot: slotId,
        worker_id: workerId,
        error: err instanceof Error ? err.message : String(err),
      })
      await sleep(Math.max(pollMs, 5000))
      continue
    }

    if (!job) {
      try {
        await sleep(pollMs, undefined, { signal })
      } catch {
        // AbortError when shutting down — fall through to loop guard.
      }
      continue
    }

    log.info('print_job_claimed', {
      slot: slotId,
      worker_id: workerId,
      job_id: job.id,
      stripe_session_id: job.stripe_session_id,
      attempts: job.attempts,
    })

    try {
      // Hold a fresh client for the lifetime of the job's DB writes.
      // The claim's transaction has already committed; subsequent
      // updates run as autocommit statements.
      await withPgClient(async (client) => {
        await processJob({
          client,
          job: job!,
          workerId,
        })
      })
    } catch (err) {
      // processJob() catches its own errors and routes them to retry /
      // manual_review; the only way an exception escapes is if the DB
      // write itself failed. In that case we leave the row in 'rendering'
      // — it will be reclaimed after a manual reset, or we can add a
      // staleness sweeper later.
      log.error('print_job_unhandled_error', {
        slot: slotId,
        worker_id: workerId,
        job_id: job.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * Bootstraps `concurrency` slots and waits for them all to finish.
 * Returns when every slot exits (i.e. `signal` was aborted).
 */
export async function runConsumer(opts: ConsumerOptions = {}): Promise<void> {
  const resolved = resolveOptions(opts)
  // Touch the pool early so a missing DATABASE_URL fails fast on boot.
  getPgPool()

  log.info('print_queue_consumer_boot', {
    worker_id: resolved.workerId,
    concurrency: resolved.concurrency,
    poll_ms: resolved.pollMs,
  })

  const slots = Array.from({ length: resolved.concurrency }, (_v, i) => runSlot(i, resolved))
  await Promise.all(slots)

  log.info('print_queue_consumer_stopped', { worker_id: resolved.workerId })
}
