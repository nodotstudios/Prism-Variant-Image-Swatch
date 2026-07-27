# Troubleshooting Guide — Prism Variant Media

## Common Issues & Solutions

### 1. Gallery images are not changing on variant selection
- **Check App Embed Status**: Open Theme Editor -> App Embeds and verify **Prism Variant Media Embed** is toggled ON and saved.
- **Check Product Status**: Ensure the product is configured in the app and the `prism_variant_media.enabled` metafield is set to `true`.
- **Check Option Names**: Make sure options like `Ring Size` are unchecked in Step 1 of the product mapper so only visual options trigger gallery changes.

### 2. Debugging Storefront Script
You can enable console debugging in the App Embed settings:
1. Open Theme Editor -> App Embeds -> Prism Variant Media Embed.
2. Check **Enable Debug Console Logging**.
3. Open your browser console (`F12` or `Cmd+Option+I`) to view `[PrismVariantMedia]` event logs.
