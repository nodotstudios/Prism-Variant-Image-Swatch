import { GalleryMapPayload, generateGroupKey } from '~/models/gallery-map.schema';

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

export function applyBulkRulesToProduct(
  product: any,
  currentGalleryMap: GalleryMapPayload,
  rules: BulkRule[]
): { updatedGalleryMap: GalleryMapPayload; matchedCount: number } {
  let matchedCount = 0;
  const newMap: GalleryMapPayload = JSON.parse(JSON.stringify(currentGalleryMap));

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

  // Link variants matching the option values
  for (const variant of product.variants?.nodes || []) {
    const variantId = variant.id;
    const selectedOptsMap: Record<string, string> = {};

    for (const opt of variant.selectedOptions || []) {
      selectedOptsMap[opt.name] = opt.value;
    }

    for (const groupKey of Object.keys(newMap.groups)) {
      newMap.variantToGroup[variantId] = groupKey;
    }
  }

  return {
    updatedGalleryMap: newMap,
    matchedCount,
  };
}
