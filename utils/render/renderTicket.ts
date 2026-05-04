import { createHmac, timingSafeEqual } from 'node:crypto'

export type RenderTicketKind = 'map' | 'session'
export type RenderTicketClass = 'proof' | 'final'

export interface RenderTicketPayload {
  kind: RenderTicketKind
  subject: string
  renderClass: RenderTicketClass
  widthPx: number
  heightPx: number
  deviceScaleFactor: number
  productUid: string
  printHash?: string
  expiresAt: number
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='), 'base64')
}

function signBody(body: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(body).digest())
}

export function createRenderTicket(payload: RenderTicketPayload, secret: string): string {
  if (!secret) throw new Error('render ticket secret is not configured')
  const body = base64url(JSON.stringify(payload))
  return `${body}.${signBody(body, secret)}`
}

export function verifyRenderTicket(ticket: string, secret: string, nowMs = Date.now()): RenderTicketPayload {
  if (!secret) throw new Error('render ticket secret is not configured')
  const [body, signature] = ticket.split('.')
  if (!body || !signature) throw new Error('Malformed render ticket')

  const expected = signBody(body, secret)
  const gotBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (gotBuffer.length !== expectedBuffer.length || !timingSafeEqual(gotBuffer, expectedBuffer)) {
    throw new Error('Invalid render ticket signature')
  }

  const payload = JSON.parse(fromBase64url(body).toString('utf8')) as RenderTicketPayload
  if (!payload.expiresAt || payload.expiresAt < nowMs) throw new Error('Render ticket expired')
  if (!['map', 'session'].includes(payload.kind)) throw new Error('Invalid render ticket kind')
  if (!['proof', 'final'].includes(payload.renderClass)) throw new Error('Invalid render ticket class')
  if (!payload.subject || !payload.productUid) throw new Error('Render ticket missing subject')
  if (!Number.isFinite(payload.widthPx) || !Number.isFinite(payload.heightPx)) {
    throw new Error('Render ticket missing dimensions')
  }
  if (!Number.isFinite(payload.deviceScaleFactor) || payload.deviceScaleFactor < 1) {
    throw new Error('Render ticket missing device scale factor')
  }
  return payload
}
