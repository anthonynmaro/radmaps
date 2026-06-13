// Editor-v2 D1 — unified selection arbiter contract.
// One selection across all editor domains: claiming in any domain evicts the
// previous owner; same-domain re-claims are idempotent (poster toolbar +
// poster Moveable hold the same claim without fighting).

import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createElementSelectionArbiter } from '~/composables/useElementSelection'

describe('createElementSelectionArbiter', () => {
  it('starts unowned', () => {
    const arbiter = createElementSelectionArbiter()
    expect(arbiter.current.value).toBeNull()
  })

  it('claim takes ownership and replaces other domains', () => {
    const arbiter = createElementSelectionArbiter()
    arbiter.claim('poster', 'slot:trail_name')
    expect(arbiter.current.value).toEqual({ domain: 'poster', key: 'slot:trail_name' })
    arbiter.claim('map', 'segment:abc')
    expect(arbiter.current.value).toEqual({ domain: 'map', key: 'segment:abc' })
  })

  it('claim is idempotent for the same domain+key (no self-eviction churn)', async () => {
    const arbiter = createElementSelectionArbiter()
    let evictions = 0
    arbiter.onEvicted('poster', () => { evictions++ })
    arbiter.claim('poster', 'slot:trail_name')
    await nextTick()
    // The second holder of the same selection (MapEditorSurface) re-claims.
    arbiter.claim('poster', 'slot:trail_name')
    await nextTick()
    expect(evictions).toBe(0)
    expect(arbiter.current.value).toEqual({ domain: 'poster', key: 'slot:trail_name' })
  })

  it('release only clears when the domain (and key, when given) still owns', () => {
    const arbiter = createElementSelectionArbiter()
    arbiter.claim('poster', 'slot:trail_name')
    arbiter.release('map')
    expect(arbiter.current.value).not.toBeNull()
    arbiter.release('poster', 'text:other')
    expect(arbiter.current.value).not.toBeNull()
    arbiter.release('poster', 'slot:trail_name')
    expect(arbiter.current.value).toBeNull()
    // Releasing when unowned is a no-op.
    arbiter.release('poster')
    expect(arbiter.current.value).toBeNull()
  })

  it('releaseAll clears unconditionally', () => {
    const arbiter = createElementSelectionArbiter()
    arbiter.claim('map', 'route')
    arbiter.releaseAll()
    expect(arbiter.current.value).toBeNull()
  })

  it('evicts the previous owner when another domain claims', async () => {
    const arbiter = createElementSelectionArbiter()
    const evicted: string[] = []
    arbiter.onEvicted('poster', previous => { evicted.push(previous.key) })
    arbiter.claim('poster', 'text:abc')
    await nextTick()
    arbiter.claim('map', 'segment:xyz')
    await nextTick()
    expect(evicted).toEqual(['text:abc'])
  })

  it('fires eviction on release-to-null (Esc / empty-space click)', async () => {
    const arbiter = createElementSelectionArbiter()
    const evicted: string[] = []
    arbiter.onEvicted('map', previous => { evicted.push(previous.key) })
    arbiter.claim('map', 'segment:xyz')
    await nextTick()
    arbiter.releaseAll()
    await nextTick()
    expect(evicted).toEqual(['segment:xyz'])
  })

  it('does NOT fire eviction on intra-domain key changes', async () => {
    const arbiter = createElementSelectionArbiter()
    let evictions = 0
    arbiter.onEvicted('poster', () => { evictions++ })
    arbiter.claim('poster', 'slot:trail_name')
    await nextTick()
    arbiter.claim('poster', 'text:abc')
    await nextTick()
    expect(evictions).toBe(0)
    expect(arbiter.current.value).toEqual({ domain: 'poster', key: 'text:abc' })
  })

  it('onEvicted returns a stop handle', async () => {
    const arbiter = createElementSelectionArbiter()
    let evictions = 0
    const stop = arbiter.onEvicted('poster', () => { evictions++ })
    arbiter.claim('poster', 'slot:trail_name')
    await nextTick()
    stop()
    arbiter.claim('map', 'route')
    await nextTick()
    expect(evictions).toBe(0)
  })
})
