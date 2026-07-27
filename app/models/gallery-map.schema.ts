export interface GalleryGroup {
  label: string;
  mediaIds: string[];
}

export interface GallerySettings {
  sharedMediaPosition: 'after' | 'before';
  hideUnassignedMedia: boolean;
  fallbackMode: 'show_all' | 'native_featured' | 'shared_only' | 'first_group';
}

export interface GalleryMapPayload {
  version: 1;
  productId: string;
  visualOptionNames: string[];
  groups: Record<string, GalleryGroup>;
  variantToGroup: Record<string, string>;
  sharedMediaIds: string[];
  settings: GallerySettings;
  updatedAt: string;
}

export function createEmptyGalleryMap(productId: string): GalleryMapPayload {
  return {
    version: 1,
    productId,
    visualOptionNames: ['Color', 'Metal', 'Finish', 'Style', 'Band Style'],
    groups: {},
    variantToGroup: {},
    sharedMediaIds: [],
    settings: {
      sharedMediaPosition: 'after',
      hideUnassignedMedia: true,
      fallbackMode: 'show_all',
    },
    updatedAt: new Date().toISOString(),
  };
}

export function generateGroupKey(selectedOptionValues: Record<string, string>): string {
  const sortedKeys = Object.keys(selectedOptionValues).sort();
  if (sortedKeys.length === 0) return 'default';
  
  return sortedKeys
    .map((k) => {
      const val = selectedOptionValues[k] || '';
      return val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    })
    .join('-');
}

export function validateGalleryMap(payload: any): payload is GalleryMapPayload {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.version !== 1) return false;
  if (typeof payload.productId !== 'string') return false;
  if (!Array.isArray(payload.visualOptionNames)) return false;
  if (typeof payload.groups !== 'object') return false;
  if (typeof payload.variantToGroup !== 'object') return false;
  if (!Array.isArray(payload.sharedMediaIds)) return false;
  return true;
}
