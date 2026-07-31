export const APP_CONFIG = {
  name: 'Prism Variant Image & Swatch',
  version: '1.0.0',
  metafields: {
    namespace: 'prism_variant_media',
    keyGalleryMap: 'gallery_map',
    keyEnabled: 'enabled',
  },
  defaults: {
    visualOptionNames: ['Color', 'Colour', 'Style', 'Pattern', 'Material', 'Finish', 'Design', 'Model'],
    nonVisualOptionNames: ['Size', 'Length', 'Quantity', 'Pack Size'],
    fallbackMode: 'show_all' as const, // 'show_all' | 'native_featured' | 'shared_only' | 'first_group'
    sharedMediaPosition: 'after' as const, // 'after' | 'before'
    hideUnassignedMedia: true,
  },
};
