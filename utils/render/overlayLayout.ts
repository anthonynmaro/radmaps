// utils/render/overlayLayout.ts
//
// Shared overlay layout: pin labels + segment leader-line legend.
// Ported from MapPreview.vue:1095-1239 (formerly private to <script setup>).
//
// The editor was the only consumer; the worker had no equivalent and so
// could not draw pins or leader lines. This module is the canonical
// source of overlay geometry — both editor and worker import it.
//
// Pure function. The caller injects:
//   • a `project(lng, lat) → {x, y}` function (editor: mapInstance.project,
//     worker: the Web Mercator projector in this file's `mercatorProjector`)
//   • viewport dimensions
//   • the route geojson
//   • the styleConfig
//
// Returns plain JS objects describing pin and leader-line layout. The
// caller renders them — DOM/CSS for the editor, SVG strings for the
// worker. The drift moat lives here: structurally identical output for
// the same inputs guarantees proof-vs-print parity.

import { getAllRouteCoords, getRouteEndpoints, resolveTrailSegmentGeojson } from '../trail'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Point2D {
  x: number
  y: number
}

export type Projector = (lngLat: [number, number]) => Point2D

export interface PinItem {
  id: 'start' | 'finish'
  label: string
  color: string
  opacity: number
  dotX: number
  dotY: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

export interface LeaderLineItem {
  id: string
  name: string
  color: string
  dotX: number
  dotY: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

export interface OverlayLayoutResult {
  pins: PinItem[]
  leaderLines: LeaderLineItem[]
}

// Subset of StyleConfig the layout needs. Avoids a hard dep on the full
// type so this module can be imported from anywhere.
interface OverlayStyleConfig {
  show_start_pin?: boolean
  show_finish_pin?: boolean
  start_pin_label?: string
  finish_pin_label?: string
  start_pin_lnglat?: [number, number]
  finish_pin_lnglat?: [number, number]
  start_label_lnglat?: [number, number]
  finish_label_lnglat?: [number, number]
  pin_color?: string
  pin_opacity?: number
  label_text_color?: string
  trail_label_style?: string
  trail_segments?: Array<{
    id: string
    name: string
    color: string
    visible: boolean
    source?: 'route-slice' | 'uploaded-track' | 'drawn-track'
    geojson?: GeoJSON.FeatureCollection
    section_start: number
    section_end: number
    label_lnglat?: [number, number]
  }>
  route_deleted_ranges?: Array<{
    start: number
    end: number
    start_index?: number
    end_index?: number
  }>
}

export interface OverlayLayoutInput {
  styleConfig: OverlayStyleConfig
  geojson: GeoJSON.FeatureCollection
  viewport: { w: number; h: number }
  project: Projector
  /** Pin-label offset distance in CSS pixels. Editor scales by container height. */
  pinOffset: number
  /**
   * Pixel heights of the chrome bands so leader labels stay clear of
   * the title and footer bands. The editor's leader SVG sits above the
   * bands in z-order; labels rendered at vMargin=8% can overlap title
   * text and look visually wrong on print. Set headerH/footerH from
   * the actual band measurements (svgTemplate.ts headerBandHeightPx,
   * footerBandHeightPx) for the worker so labels never land under
   * chrome rects (which paint on top in the worker SVG order).
   */
  headerH?: number
  footerH?: number
}

// ─── Web Mercator projector for the worker ─────────────────────────────────
//
// MapLibre uses Web Mercator with the camera at `center` and zoom level
// `zoom` (256 tile size). With bearing=0 and pitch=0 (which our frozen
// snapshots guarantee), the projection from lng/lat to screen pixels is:
//
//   worldX = (lng + 180) / 360 * 2^zoom * 256
//   worldY = (0.5 - log(tan(π/4 + lat*π/360)) / (2π)) * 2^zoom * 256
//
//   centerX, centerY computed the same way for `center`
//
//   screenX = viewport.w / 2 + (worldX - centerX)
//   screenY = viewport.h / 2 + (worldY - centerY)
//
// The `effectiveZoom` correction (locked decision #3: zoom + log2(W/editor_w))
// is applied by the caller when it computes the camera, not here.

export function mercatorProjector(opts: {
  center: [number, number]
  zoom: number
  viewport: { w: number; h: number }
}): Projector {
  const { center, zoom, viewport } = opts
  const tilesAcross = Math.pow(2, zoom)
  const worldSize = tilesAcross * 256

  function lngLatToWorld(ll: [number, number]): { x: number; y: number } {
    const x = ((ll[0] + 180) / 360) * worldSize
    const sinLat = Math.sin((ll[1] * Math.PI) / 180)
    // Clamp to avoid Infinity at the poles.
    const clamped = Math.max(-0.9999, Math.min(0.9999, sinLat))
    const y =
      (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * worldSize
    return { x, y }
  }

  const c = lngLatToWorld(center)

  return (lngLat: [number, number]): Point2D => {
    const w = lngLatToWorld(lngLat)
    return {
      x: viewport.w / 2 + (w.x - c.x),
      y: viewport.h / 2 + (w.y - c.y),
    }
  }
}

export function leaderAnchorCoord(coords: number[][]): [number, number] | null {
  const valid = coords.filter((coord): coord is [number, number] =>
    coord.length >= 2 &&
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1]),
  )
  return valid[0] ?? null
}

// ─── Layout function (the port of recomputeOverlays) ────────────────────────

/**
 * Compute pin and leader-line layout for a given snapshot of the map.
 * Pure function — no side effects, no Vue reactivity, no DOM.
 *
 * Mirrors MapPreview.vue:1095-1239 minus the drag-state branches (those
 * are editor-only and live in the caller).
 */
export function computeOverlayLayout(input: OverlayLayoutInput): OverlayLayoutResult {
  const { styleConfig, geojson, viewport, project, pinOffset } = input
  const W = viewport.w
  const H = viewport.h
  const headerH = input.headerH ?? 0
  const footerH = input.footerH ?? 0

  const pins: PinItem[] = []
  const leaderLines: LeaderLineItem[] = []

  // ── Pins (start / finish) ────────────────────────────────────────────────
  const showStartPin = styleConfig.show_start_pin !== false
  const showFinishPin = styleConfig.show_finish_pin !== false
  if (showStartPin || showFinishPin) {
    const pinColor = styleConfig.pin_color ?? styleConfig.label_text_color ?? '#1C1917'
    const pinOpacity = styleConfig.pin_opacity ?? 0.9

    const endpoints = getRouteEndpoints(geojson)
    const startLngLat: [number, number] | null =
      styleConfig.start_pin_lnglat ?? endpoints.start ?? null
    const finishLngLat: [number, number] | null =
      styleConfig.finish_pin_lnglat ?? endpoints.finish ?? null

    const candidates: Array<{
      id: 'start' | 'finish'
      show: boolean
      lngLat: [number, number] | null
      defaultLabel: string
      configuredLabel: string | undefined
      savedLabelLngLat: [number, number] | undefined
    }> = [
      {
        id: 'start',
        show: showStartPin,
        lngLat: startLngLat,
        defaultLabel: 'Start',
        configuredLabel: styleConfig.start_pin_label,
        savedLabelLngLat: styleConfig.start_label_lnglat,
      },
      {
        id: 'finish',
        show: showFinishPin,
        lngLat: finishLngLat,
        defaultLabel: 'Finish',
        configuredLabel: styleConfig.finish_pin_label,
        savedLabelLngLat: styleConfig.finish_label_lnglat,
      },
    ]

    for (const c of candidates) {
      if (!c.show || !c.lngLat) continue
      const pt = project(c.lngLat)
      // Skip if completely off-canvas (with pinOffset margin).
      if (
        pt.x < -pinOffset * 2 ||
        pt.x > W + pinOffset * 2 ||
        pt.y < -pinOffset * 2 ||
        pt.y > H + pinOffset * 2
      ) {
        continue
      }

      let labelX: number
      let labelY: number
      let anchor: 'start' | 'end'
      if (c.savedLabelLngLat) {
        const lp = project(c.savedLabelLngLat)
        labelX = lp.x
        labelY = lp.y
        anchor = lp.x < pt.x ? 'end' : 'start'
      } else {
        anchor = c.id === 'start' ? 'end' : 'start'
        labelX = c.id === 'start' ? pt.x - pinOffset * 0.7 : pt.x + pinOffset * 0.7
        labelY = pt.y - pinOffset * 0.8
      }

      pins.push({
        id: c.id,
        label: c.configuredLabel ?? c.defaultLabel,
        color: pinColor,
        opacity: pinOpacity,
        dotX: pt.x,
        dotY: pt.y,
        labelX,
        labelY,
        anchor,
      })
    }
  }

  // ── Trail segment leader-line legend ─────────────────────────────────────
  const showLeaderLines =
    styleConfig.trail_label_style === 'leader-lines' &&
    (styleConfig.trail_segments ?? []).some((s) => s.visible && s.name)

  if (showLeaderLines) {
    interface Candidate {
      seg: NonNullable<OverlayStyleConfig['trail_segments']>[number]
      dotX: number
      dotY: number
    }
    const candidates: Candidate[] = []

    for (const seg of styleConfig.trail_segments ?? []) {
      if (!seg.visible || !seg.name) continue
      const segmentGeojson = resolveTrailSegmentGeojson(
        geojson,
        seg,
        styleConfig.route_deleted_ranges ?? [],
      )
      const anchor = leaderAnchorCoord(getAllRouteCoords(segmentGeojson))
      if (!anchor) continue
      const pt = project(anchor)
      // Include slightly off-screen segments — leader still useful.
      if (
        pt.x < -W * 0.5 ||
        pt.x > W * 1.5 ||
        pt.y < -H * 0.5 ||
        pt.y > H * 1.5
      ) {
        continue
      }
      candidates.push({ seg, dotX: pt.x, dotY: pt.y })
    }

    // Distribute candidates into side label columns. Center-cluster labels are
    // assigned by side capacity plus vertical spacing so dense trail networks
    // do not pile every name onto the route body.
    const left: Candidate[] = []
    const right: Candidate[] = []
    const center: Candidate[] = []
    const minGap = Math.max(15, H * 0.018)

    for (const c of candidates) {
      if (c.dotX < W * 0.36) left.push(c)
      else if (c.dotX > W * 0.64) right.push(c)
      else center.push(c)
    }

    function sideCost(side: Candidate[], candidate: Candidate, target: 'left' | 'right'): number {
      const nearestGap = side.length
        ? Math.min(...side.map((item) => Math.abs(item.dotY - candidate.dotY)))
        : Number.POSITIVE_INFINITY
      const collisionPenalty = nearestGap < minGap ? (minGap - nearestGap) * 4 : 0
      const sidePreference = target === 'left' ? candidate.dotX / W : (W - candidate.dotX) / W
      return side.length * 100 + collisionPenalty + sidePreference * 18
    }

    center
      .sort((a, b) => a.dotY - b.dotY)
      .forEach((candidate) => {
        if (sideCost(left, candidate, 'left') <= sideCost(right, candidate, 'right')) {
          left.push(candidate)
        } else {
          right.push(candidate)
        }
      })

    function moveCenterMost(from: Candidate[], to: Candidate[]) {
      if (!from.length) return
      let moveIndex = 0
      let bestDistance = Number.POSITIVE_INFINITY
      for (let i = 0; i < from.length; i++) {
        const distance = Math.abs(from[i].dotX - W / 2)
        if (distance < bestDistance) {
          bestDistance = distance
          moveIndex = i
        }
      }
      const [moved] = from.splice(moveIndex, 1)
      to.push(moved)
    }

    while (left.length > right.length + 1) moveCenterMost(left, right)
    while (right.length > left.length + 1) moveCenterMost(right, left)

    left.sort((a, b) => a.dotY - b.dotY)
    right.sort((a, b) => a.dotY - b.dotY)

    // Editor parity: leader labels sit in side columns, then pack near
    // their route anchors instead of spreading across the full map height.
    const leftX = W * 0.10
    const rightX = W * 0.90
    // Stay inside the map area: above the footer band and below the
    // header band. Without headerH/footerH passed, we fall back to the
    // editor's vMargin = H*0.08. The editor renders its leader-label
    // SVG ON TOP of the bands (so a small overlap is visually OK), but
    // the worker SVG draws bands AFTER labels — anything inside the
    // band rect gets covered. Use the actual band height as the floor
    // so labels never disappear under chrome.
    const minVMargin = H * 0.08
    const topMargin = Math.max(minVMargin, headerH + H * 0.005)
    const bottomMargin = Math.max(minVMargin, footerH + H * 0.005)

    function distribute(
      cands: Candidate[],
    ): number[] {
      const count = cands.length
      if (count === 0) return []
      const minY = topMargin
      const maxY = H - bottomMargin

      const ys = cands.map((c) => Math.min(Math.max(c.dotY, minY), maxY))

      for (let i = 1; i < ys.length; i++) {
        ys[i] = Math.max(ys[i], ys[i - 1] + minGap)
      }

      const overflow = ys[ys.length - 1] - maxY
      if (overflow > 0) {
        for (let i = 0; i < ys.length; i++) ys[i] -= overflow
      }

      for (let i = ys.length - 2; i >= 0; i--) {
        ys[i] = Math.min(ys[i], ys[i + 1] - minGap)
      }

      const underflow = minY - ys[0]
      if (underflow > 0) {
        for (let i = 0; i < ys.length; i++) ys[i] += underflow
      }

      return ys.map((y) => Math.min(Math.max(y, minY), maxY))
    }

    // Custom-positioned labels (saved via drag in the editor) take their
    // own X/Y from label_lnglat. The remaining labels distribute evenly
    // across the available column. Exclude the custom ones from the
    // even-distribution pool so they don't consume a slot — otherwise a
    // custom-positioned segment that sorts to the top would leave the
    // top of the column empty (since its even-Y is then overridden).
    const leftAuto = left.filter((c) => !c.seg.label_lnglat)
    const rightAuto = right.filter((c) => !c.seg.label_lnglat)
    const leftAutoYs = distribute(leftAuto)
    const rightAutoYs = distribute(rightAuto)

    let leftAutoIdx = 0
    for (const c of left) {
      let labelX = leftX
      let labelY: number
      let anchor: 'start' | 'end' = 'end'
      if (c.seg.label_lnglat) {
        const lp = project(c.seg.label_lnglat)
        labelX = lp.x
        labelY = lp.y
        anchor = lp.x < c.dotX ? 'end' : 'start'
      } else {
        labelY = leftAutoYs[leftAutoIdx++]!
      }
      leaderLines.push({
        id: c.seg.id,
        name: c.seg.name,
        color: c.seg.color,
        dotX: c.dotX,
        dotY: c.dotY,
        labelX,
        labelY,
        anchor,
      })
    }
    let rightAutoIdx = 0
    for (const c of right) {
      let labelX = rightX
      let labelY: number
      let anchor: 'start' | 'end' = 'start'
      if (c.seg.label_lnglat) {
        const lp = project(c.seg.label_lnglat)
        labelX = lp.x
        labelY = lp.y
        anchor = lp.x < c.dotX ? 'end' : 'start'
      } else {
        labelY = rightAutoYs[rightAutoIdx++]!
      }
      leaderLines.push({
        id: c.seg.id,
        name: c.seg.name,
        color: c.seg.color,
        dotX: c.dotX,
        dotY: c.dotY,
        labelX,
        labelY,
        anchor,
      })
    }
  }

  return { pins, leaderLines }
}
