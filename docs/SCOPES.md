# Access Scopes Specification — Prism Variant Media

This document tracks all requested and authorized access scopes for the Prism Variant Media Shopify application.

## Active Scopes

| Scope | Purpose | Status |
| :--- | :--- | :--- |
| `read_products` | Read product details, options, variants, and product media via GraphQL Admin API. | Active |
| `write_products` | Create/update product metafield definitions (`prism_variant_media.gallery_map`) and write metafield values. | Active |

---

## Principle of Least Privilege

- REST API scopes are not used.
- No customer, checkout, order, or billing scopes are requested.
- If a future feature requires additional scopes, it will be documented here before addition.
