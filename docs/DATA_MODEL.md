# Data Model — Prism Variant Media

This document defines the schema, storage specifications, and validation rules for the variant-to-media mappings used by Prism Variant Media.

## Storage Specification

The data is stored directly in Shopify Product Metafields:

- **Namespace**: `prism_variant_media`
- **Key**: `gallery_map`
- **Type**: `json`
- **Access**:
  - Storefront: `PUBLIC_READ` (Readable by Liquid and Storefront API)
  - Admin: `READ_WRITE` (Writable by the app via GraphQL Admin API)

- **Namespace**: `prism_variant_media`
- **Key**: `enabled`
- **Type**: `boolean`
- **Access**: `PUBLIC_READ`

---

## JSON Schema Specification (`GalleryMapSchema` v1)

```typescript
interface GalleryMapPayload {
  version: 1;
  productId: string; // e.g. "gid://shopify/Product/123456789"
  visualOptionNames: string[]; // e.g. ["Color", "Band Style"]
  groups: Record<string, GalleryGroup>;
  variantToGroup: Record<string, string>; // Variant GID -> group key
  sharedMediaIds: string[]; // Media GIDs present across all visual variants
  settings: GallerySettings;
  updatedAt: string; // ISO 8601 timestamp
}

interface GalleryGroup {
  label: string; // e.g. "Platinum / Petal"
  mediaIds: string[]; // Media GIDs ordered for this group
}

interface GallerySettings {
  sharedMediaPosition: 'after' | 'before';
  hideUnassignedMedia: boolean;
  fallbackMode: 'show_all' | 'native_featured' | 'shared_only' | 'first_group';
}
```

---

## Key Principles & Design Rules

1. **Option Independence**: Non-visual options (e.g. `Ring Size`, `Length`) are omitted from `visualOptionNames`. Variants differing only in `Ring Size` map to the same `groupKey`.
2. **Media Reuse (Many-to-One)**: visually identical variants (e.g., White Gold 14K and White Gold 18K) map to the single shared `groupKey` without duplicating media uploads.
3. **Preserved Media Order**: The order of `mediaIds` array strictly dictates the storefront thumbnail and slide display sequence.
4. **Compact Serialization**: Payload size is optimized to stay well within Shopify's 10KB/64KB JSON metafield limits.
