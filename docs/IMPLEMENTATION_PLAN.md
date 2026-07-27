# Implementation Plan — Prism Variant Media

Production-ready Shopify app for assigning multiple product media items (images, videos, 3D models) to visual variant combinations (e.g. Platinum + Petal), with dynamic storefront gallery filtering.

## Executive Summary

- **App Name**: Prism Variant Media
- **Architecture**: Shopify React Router App (TypeScript) + Theme App Extension (App Embed) + GraphQL Admin API
- **Storefront Source of Truth**: Shopify Product Metafields (`prism_variant_media.gallery_map`, `prism_variant_media.enabled`)
- **Primary Theme Adapter**: Horizon (with fallback support for Dawn and generic themes)
- **Distribution**: Custom Distribution (embedded admin UI, no billing required)

---

## Technical Stack & Scopes

- **Framework**: React Router / Remix + TypeScript (Strict Mode)
- **UI Framework**: Shopify Polaris v12 + App Bridge v4
- **Database / Session Storage**: Prisma ORM (SQLite / PostgreSQL ready)
- **GraphQL API**: Shopify GraphQL Admin API (`2026-04` / latest stable)
- **Storefront Extension**: Theme App Extension (App Embed block + Vanilla TS/JS)
- **Testing**: Vitest (Unit / Schema), Playwright (E2E Storefront Browser Automation)
- **Scopes**: `read_products`, `write_products`

---

## Core Data Model (`gallery_map`)

Stored as JSON in `product.metafields.prism_variant_media.gallery_map`:

```json
{
  "version": 1,
  "productId": "gid://shopify/Product/123",
  "visualOptionNames": ["Color", "Band Style"],
  "groups": {
    "platinum-classic": {
      "label": "Platinum / Classic",
      "mediaIds": [
        "gid://shopify/MediaImage/101",
        "gid://shopify/Video/102"
      ]
    },
    "platinum-petal": {
      "label": "Platinum / Petal",
      "mediaIds": [
        "gid://shopify/MediaImage/103",
        "gid://shopify/Video/104"
      ]
    }
  },
  "variantToGroup": {
    "gid://shopify/ProductVariant/201": "platinum-classic",
    "gid://shopify/ProductVariant/202": "platinum-classic",
    "gid://shopify/ProductVariant/203": "platinum-petal"
  },
  "sharedMediaIds": ["gid://shopify/MediaImage/199"],
  "settings": {
    "sharedMediaPosition": "after",
    "hideUnassignedMedia": true,
    "fallbackMode": "show_all"
  },
  "updatedAt": "2026-07-27T22:00:00Z"
}
```

---

## Phased Implementation Roadmap

### Phase 1: Foundation & Metafield System Setup
- Idempotent Metafield Definition Service (`prism_variant_media.gallery_map`, `prism_variant_media.enabled`).
- Ensure GraphQL Admin API clients and Prisma session persistence are active.
- Set up scope definitions and verify app embedding readiness.

### Phase 2: Embedded Admin UI (Polaris + App Bridge)
- **Dashboard**: Summary metrics (configured products, stale mappings, missing combinations), quick actions, onboarding widget.
- **Product List**: Paginated GraphQL search & filter table (status, configured, collection, vendor, tag).
- **Single Product Mapper**:
  - Visual Option Selector (filters out non-visual options like Ring Size).
  - Combinations Generator (groups variants sharing identical visual attributes).
  - Media Assignment Grid (drag-and-drop reordering, primary media tag, shared media tag, type filter).
- **Bulk Mapper & Rules Engine**: Batch mapping by filename patterns (`platinum-petal`), alt text tags (`[metal:platinum]`), dry-run preview, atomic product writes.
- **CSV Import / Export**: Standardized CSV format, formula injection protection, validation report.

### Phase 3: Storefront Theme App Extension (`prism-variant-media`)
- **Liquid App Embed** (`blocks/gallery-embed.liquid`): Inject `window.__PRISM_VARIANT_MEDIA__` payload safely on enabled product pages.
- **Storefront JS Module** (`assets/prism-gallery.js`):
  - `GalleryAdapter` interface implementation: `HorizonGalleryAdapter`, `DawnGalleryAdapter`, `GenericGalleryAdapter`.
  - Multi-signal Variant Listener (`[name="id"]`, `?variant=`, variant change events, MutationObserver).
  - Main Slide & Thumbnail Filtering: Hide unassigned media, activate first visible media, pause hidden videos/3D models, update aria attributes.
  - Event Dispatcher: Emits `prism:gallery:changed` custom event.

### Phase 4: Development Test Fixture & Verification
- Create fixture product **"Cupid Oval"**:
  - Visual Options: `Color` (White Gold 14K/18K, Yellow Gold 14K/18K, Rose Gold 14K/18K, Platinum), `Band Style` (Classic, Petal, Pavé).
  - Non-visual Option: `Ring Size` (5, 6, 7).
- Execute Vitest suite (Schema validation, fallback behavior, CSV round-trip, bulk rules).
- Execute Playwright storefront test suite on Horizon theme.

### Phase 5: Documentation & Hardening
- Complete repository documentation (`README.md`, `AGENTS.md`, `docs/*`).
- Security hardening (Session tokens, webhook verification, input sanitization).
