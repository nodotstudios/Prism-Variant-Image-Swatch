# System Architecture — Prism Variant Media

```mermaid
flowchart TD
    subgraph Embedded Admin [Shopify Admin UI]
        Dashboard[Dashboard & Stats]
        ProductList[Product Catalog & Filters]
        ProductMapper[Single Product Mapper UI]
        BulkMapper[Bulk Rules Mapper Engine]
        CSVTool[CSV Import / Export]
    end

    subgraph Backend [Shopify App Server]
        GraphQLClient[GraphQL Admin API Client]
        MetafieldService[Metafield Definition & Sync Service]
        JobEngine[Background Jobs & Worker]
        SessionStore[Prisma Session Store]
    end

    subgraph Storefront [Shopify Storefront - Horizon Theme]
        LiquidEmbed[App Embed Block - gallery-embed.liquid]
        JSAdapter[Storefront JS - prism-gallery.js]
        MetafieldData[Product Metafield - prism_variant_media.gallery_map]
    end

    ProductMapper -->|Save Mapping| GraphQLClient
    BulkMapper -->|Batch Write| GraphQLClient
    GraphQLClient -->|Update Metafield| MetafieldData
    MetafieldData -->|Inject JSON Payload| LiquidEmbed
    LiquidEmbed -->|Initialize| JSAdapter
    JSAdapter -->|Filter Slides & Thumbnails| Storefront
```

---

## Key Components

1. **Embedded Admin**: Built with Polaris and App Bridge v4 inside React Router.
2. **Product Metafields**: Serves as zero-latency storefront source of truth.
3. **Storefront Embed**: Non-intrusive Liquid app embed block. Does not alter theme Liquid files directly.
4. **Adapter Pattern**: Decouples DOM selection logic from storefront event handlers.
