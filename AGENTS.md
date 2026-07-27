# Guidelines for AI Coding Assistants (AGENTS.md)

When modifying or extending **Prism Variant Media**:

1. **Strict TypeScript Compliance**: Always run `npx tsc --noEmit` and `npm run test` before submitting changes.
2. **Never Edit Native Theme Files Directly**: All storefront features must be delivered through the Theme App Extension (`extensions/prism-variant-media`).
3. **Preserve Metafield Integrity**: Use `prism_variant_media.gallery_map` JSON and `prism_variant_media.enabled` boolean metafields. Never modify unrelated product metafields.
4. **Adapter Architecture**: Storefront DOM interaction code must stay inside `HorizonAdapter` or new theme adapters in `assets/prism-gallery.js`.
5. **No REST API**: Interact exclusively via Shopify GraphQL Admin API.
