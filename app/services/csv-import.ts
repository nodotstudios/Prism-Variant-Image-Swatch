import { createEmptyGalleryMap, type GalleryMapPayload } from '~/models/gallery-map.schema';

export type CSVImportEntry = [productId: string, galleryMap: GalleryMapPayload];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.length > 1 || (row.length === 1 && row[0] !== ''));
}

function removeSanitizationPrefix(value: string): string {
  if (value.startsWith("'") && value.length > 1 && ['=', '+', '-', '@'].includes(value[1])) {
    return value.substring(1);
  }
  return value;
}

function parseList(value: string): string[] {
  const normalized = removeSanitizationPrefix(value);
  return normalized
    ? normalized.split(';').map((item) => item.trim()).filter(Boolean)
    : [];
}

export function parseCSVImport(text: string): CSVImportEntry[] {
  const rows = parseCSV(text);
  const firstHeader = rows[0]?.[0]?.replace(/^\uFEFF/, '').trim();
  if (firstHeader === 'Product Handle') rows.shift();

  const productGroups = new Map<string, GalleryMapPayload>();

  for (const row of rows) {
    if (row.length < 9) continue;

    const productId = removeSanitizationPrefix(row[1]).trim();
    if (!productId.startsWith('gid://shopify/Product/')) continue;

    const visualOptionNames = parseList(row[2]);
    const variantId = removeSanitizationPrefix(row[3]).trim();
    const groupKey = removeSanitizationPrefix(row[5]).trim();
    const groupLabel = removeSanitizationPrefix(row[6]);
    const mediaIds = parseList(row[7]);
    const sharedMediaIds = parseList(row[8]);

    if (!productGroups.has(productId)) {
      const galleryMap = createEmptyGalleryMap(productId);
      galleryMap.visualOptionNames = visualOptionNames;
      galleryMap.sharedMediaIds = sharedMediaIds;
      productGroups.set(productId, galleryMap);
    }

    const galleryMap = productGroups.get(productId)!;
    if (variantId && groupKey) galleryMap.variantToGroup[variantId] = groupKey;
    if (groupKey) {
      galleryMap.groups[groupKey] = {
        label: groupLabel,
        mediaIds,
      };
    }
  }

  return Array.from(productGroups.entries());
}
