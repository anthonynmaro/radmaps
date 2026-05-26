// render-worker-v4/src/queue/gelato.ts
//
// Gelato submission for queue-processed final print jobs. The Nuxt-flavoured
// `$fetch` helper is intentionally avoided because this code runs in plain Node.
//
// Contract:
//   • input: { snapshot, order, printFileUrl, gelatoApiKey }
//   • output: { gelato_order_id }
//   • throw on non-2xx response; the queue consumer's catch arm decides
//     retry vs manual_review.
//
// Keep the request body compact and explicit; the queue always submits the
// final Browserless render URL, never a mutable proof thumbnail.

export interface GelatoShippingAddress {
  name?: string
  email: string
  phone?: string
  address1: string
  address2?: string
  city: string
  state_code: string
  zip: string
  country_code?: string
}

export interface GelatoOrderInput {
  /** order row from `orders` table */
  order: {
    id: string
    quantity: number | string | null
    user_id?: string | null
    guest_email?: string | null
    order_reference_id?: string | null
    shipment_method_uid?: string | null
  }
  /** address dict pulled off `orders.shipping_address` JSONB column */
  shippingAddress: GelatoShippingAddress
  /** Public URL of the print artifact (the file Gelato fetches and prints) */
  printFileUrl: string
  /** snapshot.product_uid — Gelato productUid string */
  productUid: string
  /** API key — pulled from process.env.GELATO_API_KEY by the caller */
  gelatoApiKey: string
  /** Gelato order type. Use draft for faux E2E so files validate without production. */
  orderType?: 'order' | 'draft'
}

export interface GelatoOrderResult {
  gelato_order_id: string
}

export class GelatoSubmissionError extends Error {
  readonly status: number
  readonly responseBody: string
  constructor(message: string, status: number, responseBody: string) {
    super(message)
    this.name = 'GelatoSubmissionError'
    this.status = status
    this.responseBody = responseBody
  }
}

/**
 * Submit a print order to Gelato. Returns the Gelato order id on success.
 * Throws `GelatoSubmissionError` on any non-2xx response.
 *
 * Allow injection of a fetch impl so unit tests can mock without
 * monkey-patching globalThis.
 */
export async function placeGelatoOrder(
  input: GelatoOrderInput,
  fetchImpl: typeof fetch = fetch,
): Promise<GelatoOrderResult> {
  const { order, shippingAddress, printFileUrl, productUid, gelatoApiKey, orderType = 'order' } = input

  if (!printFileUrl) {
    throw new GelatoSubmissionError(
      'Print file URL is not available for this order.',
      0,
      '',
    )
  }
  if (!gelatoApiKey) {
    throw new GelatoSubmissionError('GELATO_API_KEY is not configured', 0, '')
  }

  // Split name into first/last for Gelato's address schema.
  const nameParts = (shippingAddress.name ?? '').split(' ')
  const firstName = nameParts[0] ?? ''
  const lastName = nameParts.slice(1).join(' ') || firstName

  const quantityNum = Number(order.quantity)
  const quantity = Number.isFinite(quantityNum) && quantityNum > 0 ? quantityNum : 1

  const body = {
    orderType,
    orderReferenceId: String(order.order_reference_id || order.id),
    customerReferenceId: String(order.user_id ?? order.guest_email ?? order.id),
    currency: 'USD',
    items: [
      {
        itemReferenceId: 'item-1',
        productUid,
        files: [
          {
            type: 'default',
            url: printFileUrl,
          },
        ],
        quantity,
      },
    ],
    shipmentMethodUid: order.shipment_method_uid || 'standard',
    shippingAddress: {
      firstName,
      lastName,
      addressLine1: shippingAddress.address1,
      addressLine2: shippingAddress.address2 ?? '',
      city: shippingAddress.city,
      state: shippingAddress.state_code,
      postCode: shippingAddress.zip,
      country: shippingAddress.country_code ?? 'US',
      email: shippingAddress.email,
      phone: shippingAddress.phone ?? '',
    },
  }

  const res = await fetchImpl('https://order.gelatoapis.com/v4/orders', {
    method: 'POST',
    headers: {
      'X-API-KEY': gelatoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new GelatoSubmissionError(
      `Gelato submission failed: ${res.status}`,
      res.status,
      text,
    )
  }

  let parsed: { id?: string }
  try {
    parsed = JSON.parse(text) as { id?: string }
  } catch (err) {
    throw new GelatoSubmissionError(
      `Gelato response was not JSON: ${(err as Error).message}`,
      res.status,
      text,
    )
  }

  if (!parsed.id) {
    throw new GelatoSubmissionError(
      'Gelato response missing order id',
      res.status,
      text,
    )
  }

  return { gelato_order_id: parsed.id }
}
