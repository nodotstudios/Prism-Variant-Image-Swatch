import { GalleryMapPayload } from '~/models/gallery-map.schema';

export interface CSVRow {
  productHandle: string;
  productId: string;
  visualOptions: string;
  variantId: string;
  variantTitle: string;
  groupKey: string;
  groupLabel: string;
  mediaIds: string;
  sharedMediaIds: string;
}

export function sanitizeCSVCell(cell: string): string {
  if (!cell) return '';
  const str = String(cell);
  if (['=', '+', '-', '@', '\t', '\r'].includes(str.charAt(0))) {
    return `'${str}`;
  }
  return str;
}

export function generateCSVExport(productsWithMaps: Array<{ product: any; galleryMap: GalleryMapPayload }>): string {
  const headers = [
    'Product Handle',
    'Product ID',
    'Visual Options',
    'Variant ID',
    'Variant Title',
    'Group Key',
    'Group Label',
    'Media IDs',
    'Shared Media IDs',
  ];

  const rows: string[][] = [headers];

  for (const item of productsWithMaps) {
    const { product, galleryMap } = item;
    const visualOpts = (galleryMap.visualOptionNames || []).join(';');
    const sharedMedia = (galleryMap.sharedMediaIds || []).join(';');

    const variants = product.variants?.nodes || [];

    for (const variant of variants) {
      const groupKey = galleryMap.variantToGroup?.[variant.id] || '';
      const group = galleryMap.groups?.[groupKey];
      const groupLabel = group?.label || '';
      const mediaIds = (group?.mediaIds || []).join(';');

      rows.push([
        sanitizeCSVCell(product.handle || ''),
        sanitizeCSVCell(product.id || ''),
        sanitizeCSVCell(visualOpts),
        sanitizeCSVCell(variant.id || ''),
        sanitizeCSVCell(variant.title || ''),
        sanitizeCSVCell(groupKey),
        sanitizeCSVCell(groupLabel),
        sanitizeCSVCell(mediaIds),
        sanitizeCSVCell(sharedMedia),
      ]);
    }
  }

  return rows
    .map((r) =>
      r
        .map((cell) => {
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\n');
}
