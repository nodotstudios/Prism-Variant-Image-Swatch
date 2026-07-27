# Test Plan — Prism Variant Media

This document outlines the testing strategy, test fixtures, and automated verification suites for Prism Variant Media.

## 1. Unit & Integration Testing (Vitest)

- **Schema & Migration Tests**: Validate `GalleryMapSchema` structure, fallback handling, and schema upgrades.
- **Variant-to-Group Resolution**: Verify multi-option lookup logic (e.g. `Color` + `Band Style` matches while `Ring Size` is ignored).
- **Shared Media Merging**: Test `before` and `after` positions for shared media item ordering.
- **CSV Import/Export**: Verify round-trip parsing, formula injection sanitization, and invalid GID detection.
- **Bulk Mapping Rules Engine**: Test pattern matching logic (filenames e.g. `platinum-petal`, alt text `[metal:platinum]`).

---

## 2. Storefront E2E Testing (Playwright)

Executed against connected Shopify Development Store on the Horizon theme:

1. **Initial Page Load**: Verify correct gallery filtering when landing directly on a `?variant=12345` URL.
2. **Visual Option Changing**:
   - Changing `Color` updates both main gallery slides and thumbnail list.
   - Changing `Band Style` updates gallery correctly.
3. **Non-Visual Option Independence**:
   - Changing `Ring Size` does NOT alter active gallery images or reset slide selection.
4. **Media Types**:
   - Verify HTML5 videos and YouTube/Vimeo embeds pause automatically when hidden.
5. **Accessibility**:
   - Verify `aria-hidden="true"` on hidden slides/thumbnails.
   - Verify keyboard navigation skips hidden elements.
