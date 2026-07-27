export const APP_CONFIG = {
  name: 'PRISMA-Grouper',
  version: '1.0.0',
  metafields: {
    namespace: 'prism_variant_media',
    keyGalleryMap: 'gallery_map',
    keyEnabled: 'enabled',
  },
  defaults: {
    visualOptionNames: ['Color', 'Colour', 'Metal', 'Finish', 'Style', 'Band Style', 'Material', 'Pattern'],
    nonVisualOptionNames: ['Size', 'Ring Size', 'Length', 'Quantity'],
    fallbackMode: 'show_all' as const, // 'show_all' | 'native_featured' | 'shared_only' | 'first_group'
    sharedMediaPosition: 'after' as const, // 'after' | 'before'
    hideUnassignedMedia: true,
  },
};
