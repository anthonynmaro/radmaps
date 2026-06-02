# Product Mockups

RadMaps product mockups are RadMaps-rendered merchandising previews. The scene
images come from the saved Gelato template exports in
`assets/product_mockup_templates`; Gelato still receives the normal final print
render from the Browserless/Railway fulfillment path.

The renderer uses the provided wall-setting JPEGs as the base scene and replaces
the sample artwork inside the product face with the current RadMaps proof or
premade render. For wall hangings, it then reapplies the original rail strips
from the saved template above the inserted map so the magnetic rails, wood
texture, and shadows remain visible. It does not generate synthetic wall scenes.

## Template Policy

- The saved template images in `assets/product_mockup_templates` are the source
  of truth for mockup scenes.
- Use `Close-Up-Bed-Room-White-0.jpeg` for flat poster, wall hanging, aluminum,
  and acrylic hero mockups. Use `Close-Up-Lobby-Dark-Emerald-0.jpeg` for framed
  poster hero mockups because the current framed exports do not include the
  bedroom scene.
- Keep the product catalog aligned to those saved Gelato template variants.
- Do not offer a physical SKU unless it resolves to a template asset and the
  normal print renderer can produce the required aspect.
- The current 12×16 poster asset is intentionally not offered because RadMaps is
  still locked to the 2:3 portrait print family.
- If a template asset is replaced or the art placement changes, bump
  `PRODUCT_MOCKUP_TEMPLATE_VERSION` or `PRODUCT_MOCKUP_RENDERER_VERSION`.

## Runtime Shape

- Feature flag: `FLAGS.PRODUCT_MOCKUPS`; local development enables it so the
  checkout can be visually tested without seeding a flag row.
- Cache table: `product_mockups`.
- API: `POST /api/mockups/render` with
  `{ source: { type: "map" | "premade", id }, product_uid }`.
- Mockup `source.id` is a map UUID for custom maps. For premade maps it can be
  a database UUID or a slug, so local/static premade fallback can render mockups
  before the premade row exists in Supabase.
- Provider output: JPEG uploaded to the `maps` bucket at
  `renders/mockups/{source_type}/{source_id}/{product_uid}/{mockup_hash}.jpg`.
- Cache key: source type/id, product UID, source render hash, template asset ID,
  template version, and renderer version.
- Current template placement version: `gelato-saved-template-room-scenes-v2`.
- Current compositor version: `template-asset-compositor-v6`.

Custom checkout lazily renders only the selected physical product after the
selected print proof is ready. Premade checkout renders the selected product
mockup when a premade render is available. Mockup failures never block payment.

## Catalog Notes

The six template families currently represented are:

- Archival matte flat poster.
- Premium mounted wood framed poster in black, white, and natural wood.
- Wall hanging on archival matte paper with black, white, natural, and dark wood rails.
- Wall hanging on silk paper with black, white, natural, and dark wood rails.
- Matte aluminum.
- Gloss acrylic.

Canvas, brushed aluminum, 12×16 poster, and other unmatched variants are not
offered until matching templates and print-render geometry are added.

## Gelato API Audit

Gelato's documented ecommerce template API only supports fetching a known
template ID at `GET /v1/templates/{templateId}`. It does not expose a public
"list my saved templates" endpoint. The UUID folders exported into
`assets/product_mockup_templates` return 404 from that endpoint, so treat those
UUIDs as RadMaps template asset set IDs rather than verified Gelato ecommerce
template IDs.

The Product API does validate the concrete product UIDs. As of the latest local
audit, all 55 exported asset product UIDs are recognized by Gelato with
`ProductStatus=activated` and `State=published`; 53 of those are enabled in the
RadMaps catalog.

Two exported poster assets are intentionally not enabled:

- `flat_300x400-mm-12x16-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver`
  because it is a 3:4 product and RadMaps currently renders only 2:3 prints.
- `flat_1000x1500-mm-40x60-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver`
  because RadMaps does not yet have a 40×60 print size/profile.

## Backfill

Run the premade backfill against a server where `product_mockups` is enabled:

```bash
npm run mockups:backfill-products -- --site-url=http://localhost:3001
```

Use `--dry-run`, `--limit`, `--concurrency`, `--ids`, or `--product-uids` to
scope the run.

## Gelato Validation

Run the saved-template/product audit with:

```bash
npm run mockups:audit-gelato-templates
```

Use `--json` for machine-readable output, `--product-limit=<n>` for a smaller
API check, or `--skip-product-api` when you only want the local asset summary.
