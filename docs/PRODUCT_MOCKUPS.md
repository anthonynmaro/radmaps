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
- Use the saved wall-setting scenes that exist for the selected SKU in checkout galleries.
  The default hero scene stays first: `Close-Up-Bed-Room-White-0.jpeg` for flat
  poster, wall hanging, aluminum, and acrylic products, and
  `Close-Up-Lobby-Dark-Emerald-0.jpeg` for framed poster products because the
  current framed exports do not include the bedroom scene.
- Do not expose `Simple.jpeg` in checkout galleries. It is a product-only packshot,
  not an in-room wall mockup, and should stay out of all product galleries.
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
- Template API: `GET /api/mockups/templates?product_uid=...` returns the
  available saved scene templates for a physical SKU, including the normalized
  artwork box, wall-hanging chrome crop boxes, and a validated
  `template_image_url`.
- Template image API: `GET /api/mockups/template-image?product_uid=...&mockup_template_id=...`
  streams the saved JPEG template for browser-side preview composition. The
  route resolves the product/template through the registry instead of accepting
  arbitrary file paths.
- Render API: `POST /api/mockups/render` with
  `{ source: { type: "map" | "premade", id }, product_uid, mockup_template_id? }`.
- Mockup `source.id` is a map UUID for custom maps. For premade maps it can be
  a database UUID or a slug, so local/static premade fallback can render mockups
  before the premade row exists in Supabase.
- Provider output: JPEG uploaded to the `maps` bucket at
  `renders/mockups/{source_type}/{source_id}/{product_uid}/{mockup_hash}.jpg`.
- Cache key: source type/id, product UID, source render hash, template asset ID,
  template version, and renderer version.
- Current template placement version: `gelato-saved-template-traced-slots-v7`.
- Current compositor version: `template-asset-compositor-v25`.

Checkout uses traced template slots instead of product-size scaling. Each
selected SKU resolves to a canonical large saved Gelato asset for its product
family/material, then the browser places the already-rendered map as a
`background-size: cover` fill inside the traced product surface. Frame and
wall-hanging chrome is replayed from cropped regions of the saved template above
the inserted map, with framed top/bottom chrome kept at matching thickness.
Size selection still controls proof/final print geometry and
Gelato ordering, but merchandising mockups use one stable visual scale per
product family/material. Mockup failures never block payment.

The browser preview and server compositor share the same artwork edge overprint
rules so the replacement map sits slightly underneath paper, frame, rail, and
surface edges. The room wall-hanging slot is traced from the visible product
body rather than the rail crop, which keeps the inserted poster from spilling
past the right edge of the hanging.
Gloss acrylic templates render small brushed-metal hardware discs above the
inserted map, while keeping the acrylic glare as a separate finish overlay. The
hardware layer is generated instead of cropped from the saved template so old
poster or wall pixels cannot leak into the four acrylic corners; placement is
matched to the saved-template hardware centers.
The aluminum Room scene also has a dedicated face trace because its saved
template carries a darker product-edge treatment than the flat poster scene;
the inserted artwork and metallic sheen both use the overprinted face box so the
sample poster cannot peek through at the top edge.

Checkout keeps the currently displayed mockup mounted while templates for a new
format, finish, or size are loading. This avoids flashing back to the raw map
image during product selection; once the next template response is ready, the
gallery swaps to the matching scene for the newly selected product.

Artwork is stretched into the traced product slot instead of cropped with
`cover`. The templates are straight-on merchandising scenes, and preserving the
full poster inside the rails/frame is more important than pixel-perfect map
inspection in this gallery preview.
Wall-hanging templates use zero artwork bleed so the top/bottom rail and hanger
details remain owned by the template chrome layer rather than being covered by
the inserted map.
The Emerald wall wall-hanging scene has its own rail/body trace because its
bottom rail sits lower than the Room scene; the artwork ends before that rail so
the footer band cannot spill into the rail edge.
The framed Close-up scene also uses scene-specific face bounds, a small left/top
artwork overprint to hide browser subpixel seams, and a right edge traced to the
inside edge of the dark frame, so the replacement map sits flush without tinting
the side frame.

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
