// render-worker-v4/src/db.ts
//
// Two clients:
//   • supabase  — service-role REST client for table reads/writes that don't
//                 need row-level locking (render_cache, product_renders,
//                 maps, order_snapshots reads).
//   • pgPool    — direct Postgres pool, lazily initialised. Required for
//                 Phase 8 print-queue consumer (SELECT … FOR UPDATE
//                 SKIP LOCKED) which PostgREST cannot express.
//
// Service-role keys bypass RLS, so all access here must be intentional and
// scoped to known stripe_session_id / map_id values from authenticated
// requests.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Pool, type PoolClient } from 'pg'

import { CONFIG } from './config.js'
import { log } from './log.js'

let _supabase: SupabaseClient | null = null
let _pgPool: Pool | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  _supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return _supabase
}

export function getPgPool(): Pool {
  if (_pgPool) return _pgPool
  if (!CONFIG.databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set; pg-backed features (print queue) are disabled',
    )
  }
  _pgPool = new Pool({
    connectionString: CONFIG.databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    // Supabase pooler requires SSL; use rejectUnauthorized=false because the
    // pooler presents a Supabase cert chain that doesn't validate against
    // the system store on a slim node image.
    ssl: { rejectUnauthorized: false },
  })
  _pgPool.on('error', (err: Error) => {
    log.error('pg_pool_error', { message: err.message })
  })
  return _pgPool
}

export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function shutdownDb(): Promise<void> {
  if (_pgPool) {
    await _pgPool.end()
    _pgPool = null
  }
}
