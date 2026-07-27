# Prism Variant Media — Shopify App

Production-ready Shopify App for assigning multiple product media items (images, Shopify-hosted videos, external videos, and 3D models) to visual variant combinations (e.g., *Platinum + Petal*, *Yellow Gold 14K + Classic*).

On the storefront, changing visual variant options filters main slides and thumbnails without affecting non-visual options (such as *Ring Size*), pricing, or checkout.

---

## Technical Features

- **Storefront Source of Truth**: Shopify Product Metafields (`prism_variant_media.gallery_map`, `prism_variant_media.enabled`). Zero-latency gallery switching without live app server requests.
- **Embedded Admin UI**: Polaris v12 + App Bridge v4 embedded mapping interface.
- **Multi-Option Mapping**: Group multiple variants (e.g., 14K and 18K) into a single visual gallery group to avoid duplicating media uploads.
- **Bulk Automation**: Rules engine for scanning media filenames and alt-text tags across 1,000+ catalogue items.
- **Theme App Extension**: App embed block (`blocks/gallery-embed.liquid`) targeted for the **Horizon** theme with fallback support for **Dawn** and generic themes.
- **CSV Import / Export**: Standardized CSV format with formula injection protection.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database & Prisma
```bash
npm run setup
```

### 3. Run Unit Tests
```bash
npm run test
```

### 4. Start Development Server & Tunnel
```bash
shopify app dev
```

---

## Documentation Index

- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/THEME_ADAPTERS.md`](docs/THEME_ADAPTERS.md)
- [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md)
- [`docs/SCOPES.md`](docs/SCOPES.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/MERCHANT_GUIDE.md`](docs/MERCHANT_GUIDE.md)
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
