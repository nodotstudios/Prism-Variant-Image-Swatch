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
    visualOptionNames: [],
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

const NON_VISUAL_OPTION_NAMES = new Set(['size', 'length', 'quantity', 'pack size', 'title']);

export function normalizeVisualOptionNames(
  configuredNames: string[],
  productOptionNames: string[],
): string[] {
  const productNamesByLowercase = new Map(
    productOptionNames.map((name) => [name.trim().toLowerCase(), name]),
  );
  const configuredProductNames = configuredNames
    .map((name) => productNamesByLowercase.get(name.trim().toLowerCase()))
    .filter((name): name is string => Boolean(name));

  if (configuredProductNames.length > 0) {
    return Array.from(new Set(configuredProductNames));
  }

  return productOptionNames.filter(
    (name) => !NON_VISUAL_OPTION_NAMES.has(name.trim().toLowerCase()),
  );
}

export function rebuildVariantToGroup(
  combinations: Record<string, { variantIds: string[] }>,
  groups: Record<string, GalleryGroup>,
): Record<string, string> {
  const variantToGroup: Record<string, string> = {};
  for (const [groupKey, combination] of Object.entries(combinations)) {
    if (!groups[groupKey]) continue;
    for (const variantId of combination.variantIds) {
      variantToGroup[variantId] = groupKey;
    }
  }
  return variantToGroup;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

export function validateGalleryMap(payload: unknown): payload is GalleryMapPayload {
  if (!isRecord(payload)) return false;
  if (payload.version !== 1) return false;
  if (typeof payload.productId !== 'string') return false;
  if (!isStringArray(payload.visualOptionNames)) return false;
  if (!isRecord(payload.groups)) return false;
  if (!isRecord(payload.variantToGroup)) return false;
  if (!isStringArray(payload.sharedMediaIds)) return false;
  if (typeof payload.updatedAt !== 'string') return false;

  for (const group of Object.values(payload.groups)) {
    if (!isRecord(group) || typeof group.label !== 'string' || !isStringArray(group.mediaIds)) {
      return false;
    }
  }

  if (!Object.values(payload.variantToGroup).every((groupKey) => typeof groupKey === 'string')) {
    return false;
  }

  if (!isRecord(payload.settings)) return false;
  if (payload.settings.sharedMediaPosition !== 'after' && payload.settings.sharedMediaPosition !== 'before') {
    return false;
  }
  if (typeof payload.settings.hideUnassignedMedia !== 'boolean') return false;
  if (!['show_all', 'native_featured', 'shared_only', 'first_group'].includes(String(payload.settings.fallbackMode))) {
    return false;
  }

  return true;
}
