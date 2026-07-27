# Theme Adapters Specification — Prism Variant Media

This document describes how `prism-gallery.js` safely interacts with active Shopify themes without modifying theme code directly.

## Interface Definition

```typescript
interface GalleryAdapter {
  detect(): boolean;
  getMediaElements(): Array<{ element: HTMLElement; mediaId: string }>;
  getThumbnailElements(): Array<{ element: HTMLElement; mediaId: string }>;
  showMedia(activeMediaIds: string[]): void;
  activateFirstVisible(activeMediaIds: string[]): void;
  pauseHiddenMedia(): void;
  refresh(): void;
}
```

---

## Supported Theme Adapters

### 1. Horizon Theme Adapter (`HorizonGalleryAdapter`)
- **Priority**: Primary development target.
- **Media Containers**: `media-gallery`, `.product-media-container`, `[data-media-id]`
- **Thumbnails**: `.thumbnail-list`, `[data-target]`
- **Variant Change Integration**: Listens to native `variant-change` events on `variant-selects` and form `[name="id"]`.
- **Dynamic Re-rendering**: Re-attaches DOM observers after section updates.

### 2. Dawn Theme Adapter (`DawnGalleryAdapter`)
- **Media Containers**: `media-gallery`, `.product__media-item`, `[data-media-id]`
- **Thumbnails**: `.thumbnail-list__item`, `[data-target]`

### 3. Generic Theme Adapter (`GenericGalleryAdapter`)
- **Fallback Mechanism**: Uses `data-media-id` attributes, image src matching, and standard product gallery CSS class patterns.
- **Fail-Open Strategy**: If no adapter matches or parsing fails, the theme gallery falls back safely to its native un-filtered display.
