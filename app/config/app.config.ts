export const APP_CONFIG = {
  name: 'Prism Variant Image & Swatch',
  version: '1.0.0',
  requiredScopes: ['read_products', 'write_products'] as const,
  metafields: {
    namespace: 'prism_variant_media',
    keyGalleryMap: 'gallery_map',
    keyEnabled: 'enabled',
  },
  themeExtension: {
    blockHandle: 'gallery-embed',
  },
  plans: {
    FREE: {
      name: 'Free Plan',
      price: 0,
      productLimit: 10,
    },
    PRO: {
      name: 'Pro Plan',
      price: 9.99,
      productLimit: 100,
    },
    ENTERPRISE: {
      name: 'Enterprise Plan',
      price: 29.99,
      productLimit: Infinity,
    },
  },
  defaults: {
    visualOptionNames: ['Color', 'Colour', 'Style', 'Pattern', 'Material', 'Finish', 'Design', 'Model'],
    nonVisualOptionNames: ['Size', 'Length', 'Quantity', 'Pack Size'],
    fallbackMode: 'show_all' as const, // 'show_all' | 'native_featured' | 'shared_only' | 'first_group'
    sharedMediaPosition: 'after' as const, // 'after' | 'before'
    hideUnassignedMedia: true,
  },
};
