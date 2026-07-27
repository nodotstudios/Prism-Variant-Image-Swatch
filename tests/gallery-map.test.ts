import { describe, it, expect } from 'vitest';
import { generateGroupKey, validateGalleryMap, createEmptyGalleryMap } from '../app/models/gallery-map.schema';
import { sanitizeCSVCell, generateCSVExport } from '../app/services/csv.server';
import { applyBulkRulesToProduct, BulkRule } from '../app/services/bulk-rules.server';

describe('GalleryMap Schema & Utilities', () => {
  it('should generate consistent group keys from visual option combinations', () => {
    const key1 = generateGroupKey({ Color: 'Platinum', 'Band Style': 'Petal' });
    const key2 = generateGroupKey({ 'Band Style': 'Petal', Color: 'Platinum' });
    expect(key1).toBe('petal-platinum');
    expect(key1).toBe(key2);
  });

  it('should validate valid gallery map payloads', () => {
    const map = createEmptyGalleryMap('gid://shopify/Product/123');
    expect(validateGalleryMap(map)).toBe(true);
  });

  it('should reject invalid gallery map payloads', () => {
    expect(validateGalleryMap(null)).toBe(false);
    expect(validateGalleryMap({ version: 2 })).toBe(false);
  });
});

describe('CSV Security & Sanitization', () => {
  it('should escape CSV cells to prevent formula injection', () => {
    expect(sanitizeCSVCell('=SUM(1+1)')).toBe("'=SUM(1+1)");
    expect(sanitizeCSVCell('@eval')).toBe("'@eval");
    expect(sanitizeCSVCell('Normal Text')).toBe('Normal Text');
  });

  it('should generate properly formatted CSV content', () => {
    const mockMap = createEmptyGalleryMap('gid://shopify/Product/123');
    mockMap.groups['platinum-petal'] = {
      label: 'Platinum / Petal',
      mediaIds: ['gid://shopify/MediaImage/101'],
    };
    mockMap.variantToGroup['gid://shopify/ProductVariant/201'] = 'platinum-petal';

    const csv = generateCSVExport([
      {
        product: {
          id: 'gid://shopify/Product/123',
          handle: 'cupid-oval',
          variants: {
            nodes: [{ id: 'gid://shopify/ProductVariant/201', title: 'Platinum / Petal / 6' }],
          },
        },
        galleryMap: mockMap,
      },
    ]);

    expect(csv).toContain('Product Handle');
    expect(csv).toContain('"cupid-oval"');
    expect(csv).toContain('"platinum-petal"');
  });
});

describe('Bulk Rules Engine', () => {
  it('should match media filename and generate group mapping', () => {
    const initialMap = createEmptyGalleryMap('gid://shopify/Product/123');
    const mockProduct = {
      media: {
        nodes: [
          {
            id: 'gid://shopify/MediaImage/101',
            image: { url: 'https://cdn.shopify.com/s/files/1/platinum-petal-1.jpg' },
          },
        ],
      },
      variants: {
        nodes: [
          {
            id: 'gid://shopify/ProductVariant/201',
            selectedOptions: [
              { name: 'Color', value: 'Platinum' },
              { name: 'Band Style', value: 'Petal' },
            ],
          },
        ],
      },
    };

    const rules: BulkRule[] = [
      {
        id: 'r1',
        patternType: 'filename',
        matchValue: 'platinum-petal',
        targetGroupLabel: 'Platinum / Petal',
        optionValues: { Color: 'Platinum', 'Band Style': 'Petal' },
      },
    ];

    const result = applyBulkRulesToProduct(mockProduct, initialMap, rules);
    expect(result.matchedCount).toBeGreaterThan(0);
    expect(Object.keys(result.updatedGalleryMap.groups).length).toBe(1);
  });
});
