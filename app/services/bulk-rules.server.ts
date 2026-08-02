import { generateGroupKey, type GalleryMapPayload } from '~/models/gallery-map.schema';

export interface BulkRule {
  id: string;
  patternType: 'filename' | 'alt_text';
  matchValue: string;
  targetGroupLabel: string;
  optionValues: Record<string, string>; // e.g. { "Color": "Platinum", "Band Style": "Petal" }
  isSharedMedia?: boolean;
}

export interface DryRunResult {
  productId: string;
  productTitle: string;
  matchedRulesCount: number;
  updatedGroupsCount: number;
  previewPayload: GalleryMapPayload;
}

export interface BulkRuleProduct {
  media?: {
    nodes?: Array<{
      id: string;
      image?: { url: string } | null;
      sources?: Array<{ url: string }>;
      alt?: string | null;
    }>;
  };
  variants?: {
    nodes?: Array<{
      id: string;
      selectedOptions?: Array<{ name: string; value: string }>;
    }>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBulkRules(value: unknown): value is BulkRule[] {
  return Array.isArray(value) && value.length > 0 && value.every((rule) => {
    if (!isRecord(rule) || !isRecord(rule.optionValues)) return false;
    return (
      typeof rule.id === 'string' &&
      (rule.patternType === 'filename' || rule.patternType === 'alt_text') &&
      typeof rule.matchValue === 'string' &&
      rule.matchValue.trim().length > 0 &&
      typeof rule.targetGroupLabel === 'string' &&
      Object.values(rule.optionValues).every((optionValue) => typeof optionValue === 'string') &&
      (rule.isSharedMedia === undefined || typeof rule.isSharedMedia === 'boolean')
    );
  });
}

export function applyBulkRulesToProduct(
  product: BulkRuleProduct,
  currentGalleryMap: GalleryMapPayload,
  rules: BulkRule[]
): { updatedGalleryMap: GalleryMapPayload; matchedCount: number } {
  let matchedCount = 0;
  const newMap: GalleryMapPayload = JSON.parse(JSON.stringify(currentGalleryMap));
  const matchedGroupOptions = new Map<string, Record<string, string>>();

  const mediaList = product.media?.nodes || [];

  for (const media of mediaList) {
    const mediaId = media.id;
    const filename = (media.image?.url || media.sources?.[0]?.url || '').toLowerCase();
    const altText = (media.alt || '').toLowerCase();

    for (const rule of rules) {
      const matchVal = rule.matchValue.toLowerCase();
      let matches = false;

      if (rule.patternType === 'filename' && filename.includes(matchVal)) {
        matches = true;
      } else if (rule.patternType === 'alt_text' && altText.includes(matchVal)) {
        matches = true;
      }

      if (matches) {
        matchedCount++;
        if (rule.isSharedMedia) {
          if (!newMap.sharedMediaIds.includes(mediaId)) {
            newMap.sharedMediaIds.push(mediaId);
          }
        } else {
          const groupKey = generateGroupKey(rule.optionValues);
          matchedGroupOptions.set(groupKey, rule.optionValues);
          if (!newMap.groups[groupKey]) {
            newMap.groups[groupKey] = {
              label: rule.targetGroupLabel || groupKey,
              mediaIds: [],
            };
          }
          if (!newMap.groups[groupKey].mediaIds.includes(mediaId)) {
            newMap.groups[groupKey].mediaIds.push(mediaId);
          }
        }
      }
    }
  }

  const groupMatches = Array.from(matchedGroupOptions.entries()).sort(
    ([, firstOptions], [, secondOptions]) =>
      Object.keys(secondOptions).length - Object.keys(firstOptions).length,
  );

  // Link only variants whose selected option values satisfy a matched rule.
  for (const variant of product.variants?.nodes || []) {
    const selectedOptions = new Map(
      (variant.selectedOptions || []).map((option) => [option.name.toLowerCase(), option.value.toLowerCase()]),
    );

    for (const [groupKey, requiredOptions] of groupMatches) {
      const matches = Object.entries(requiredOptions).every(
        ([optionName, optionValue]) =>
          selectedOptions.get(optionName.toLowerCase()) === optionValue.toLowerCase(),
      );
      if (matches) {
        newMap.variantToGroup[variant.id] = groupKey;
        break;
      }
    }
  }

  return {
    updatedGalleryMap: newMap,
    matchedCount,
  };
}
