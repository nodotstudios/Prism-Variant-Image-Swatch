import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useSubmit, Form } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Button, Banner, DropZone, ProgressBar, InlineStack, Badge, Box, Divider, List } from '@shopify/polaris';
import { useState, useCallback } from 'react';
import { authenticate } from '../shopify.server';
import { getProductsCatalog } from '~/services/graphql.server';
import { getProductGalleryMap, saveProductGalleryMap } from '~/services/metafields.server';
import { generateCSVExport } from '~/services/csv.server';
import { GalleryMapPayload } from '~/models/gallery-map.schema';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const catalog = await getProductsCatalog(admin, { first: 50 });

  const productsWithMaps = [];
  for (const prod of catalog.products) {
    const fullData = await getProductGalleryMap(admin, prod.id);
    if (fullData) {
      productsWithMaps.push({ product: fullData.product, galleryMap: fullData.galleryMap });
    }
  }

  const csvContent = generateCSVExport(productsWithMaps);

  return { csvContent, count: productsWithMaps.length };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const productId = formData.get('productId') as string;
  const payloadStr = formData.get('galleryMap') as string;
  
  if (!productId || !payloadStr) {
    return { success: false, error: 'Missing required fields' };
  }
  
  try {
    const galleryMap = JSON.parse(payloadStr);
    // Auto-enable for products updated via CSV import
    await saveProductGalleryMap(admin, productId, galleryMap, true);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

function parseCSV(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i+1] === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i+1] === '\n') i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  // Remove empty rows
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

export default function CSVPage() {
  const { csvContent, count } = useLoaderData<typeof loader>();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [report, setReport] = useState<{ successes: number; failures: number; errors: string[] } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleDownloadCSV = () => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'prism_variant_media_mappings.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      setFile(acceptedFiles[0]);
      setReport(null);
    },
    [],
  );

  const removeUnescapedPrefixes = (str: string) => {
    if (str.startsWith("'") && (str.length > 1) && ['=', '+', '-', '@'].includes(str[1])) {
      return str.substring(1);
    }
    return str;
  };

  const processImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setReport(null);
    setProgress(0);
    
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      // Skip header
      if (rows.length > 0 && rows[0][0].includes('Product Handle')) {
        rows.shift();
      }

      // Group by Product ID
      const productGroups = new Map<string, GalleryMapPayload>();
      
      for (const row of rows) {
        if (row.length < 9) continue;
        
        const productId = removeUnescapedPrefixes(row[1]);
        if (!productId || !productId.startsWith('gid://shopify/Product/')) continue;
        
        const visualOptsStr = removeUnescapedPrefixes(row[2]);
        const variantId = removeUnescapedPrefixes(row[3]);
        const groupKey = removeUnescapedPrefixes(row[5]);
        const groupLabel = removeUnescapedPrefixes(row[6]);
        const mediaIdsStr = removeUnescapedPrefixes(row[7]);
        const sharedMediaStr = removeUnescapedPrefixes(row[8]);
        
        if (!productGroups.has(productId)) {
          productGroups.set(productId, {
            visualOptionNames: visualOptsStr ? visualOptsStr.split(';').filter(Boolean) : [],
            variantToGroup: {},
            groups: {},
            sharedMediaIds: sharedMediaStr ? sharedMediaStr.split(';').filter(Boolean) : []
          });
        }
        
        const payload = productGroups.get(productId)!;
        
        if (variantId && groupKey) {
          payload.variantToGroup[variantId] = groupKey;
        }
        
        if (groupKey) {
          payload.groups[groupKey] = {
            label: groupLabel || '',
            mediaIds: mediaIdsStr ? mediaIdsStr.split(';').filter(Boolean) : []
          };
        }
      }

      const totalProducts = productGroups.size;
      setTotal(totalProducts);
      
      let successes = 0;
      let failures = 0;
      const errors: string[] = [];

      // Process sequentially to avoid rate limits and timeouts
      for (const [productId, payload] of productGroups.entries()) {
        if (controller.signal.aborted) break;
        
        try {
          let token = "";
          if (window.shopify) {
             token = await window.shopify.idToken();
          }

          const formData = new URLSearchParams();
          formData.append('productId', productId);
          formData.append('galleryMap', JSON.stringify(payload));

          const res = await fetch('/app/csv', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData,
            signal: controller.signal
          });
          
          const result = await res.json();
          if (result.success) {
            successes++;
          } else {
            failures++;
            errors.push(`Product ${productId}: ${result.error}`);
          }
        } catch (e: any) {
          if (e.name === 'AbortError') break;
          failures++;
          errors.push(`Product ${productId}: Network/Timeout error`);
        }
        
        setProgress(prev => prev + 1);
      }
      
      if (!controller.signal.aborted) {
        setReport({ successes, failures, errors });
      }

    } catch (e: any) {
      setReport({ successes: 0, failures: 1, errors: [e.message] });
    } finally {
      setImporting(false);
      setAbortController(null);
    }
  };

  const cancelImport = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  return (
    <Page title="CSV Import & Export" subtitle="Backup, bulk edit, or migrate variant media mappings using CSV spreadsheets">
      <BlockStack gap="500">
        <Banner title="CSV Format Specifications" tone="info">
          <p>The import requires the exact same column format as the export. Uploading a CSV will automatically update mappings and enable the "Prism Variant Media" toggle for those products.</p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Export Catalog Mappings</Text>
                <Text as="h3" variant="headingSm">Export ({count.toString()} Products Loaded):</Text>
                <Button variant="primary" onClick={handleDownloadCSV} disabled={importing}>
                  Download CSV Export File
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Import Catalog Mappings</Text>
                
                {!file ? (
                  <DropZone accept=".csv" type="file" onDrop={handleDropZoneDrop}>
                    <DropZone.FileUpload actionHint="Accepts .csv files" />
                  </DropZone>
                ) : (
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" variant="bodyMd" fontWeight="bold">
                        {file.name}
                      </Text>
                      <Button variant="plain" tone="critical" onClick={() => setFile(null)} disabled={importing}>
                        Remove File
                      </Button>
                    </InlineStack>
                    
                    {importing ? (
                      <BlockStack gap="200">
                        <ProgressBar progress={total > 0 ? (progress / total) * 100 : 0} size="small" tone="primary" />
                        <InlineStack align="space-between">
                          <Text as="p" tone="subdued">Importing {progress} of {total} products...</Text>
                          <Button variant="plain" tone="critical" onClick={cancelImport}>Cancel Import</Button>
                        </InlineStack>
                      </BlockStack>
                    ) : (
                      <Button variant="primary" onClick={processImport} disabled={importing}>
                        Process Import File
                      </Button>
                    )}
                  </BlockStack>
                )}

                {report && (
                  <Box paddingBlockStart="400">
                    <Divider />
                    <Box paddingBlockStart="400">
                      <BlockStack gap="300">
                        <Text as="h3" variant="headingMd">Import Report</Text>
                        <InlineStack gap="300">
                          <Badge tone="success">{report.successes} Successful</Badge>
                          <Badge tone={report.failures > 0 ? "critical" : "info"}>{report.failures} Failed</Badge>
                        </InlineStack>
                        
                        {report.errors.length > 0 && (
                          <Banner tone="critical" title="Errors encountered during import">
                            <List type="bullet">
                              {report.errors.map((err, i) => (
                                <List.Item key={i}>{err}</List.Item>
                              ))}
                            </List>
                          </Banner>
                        )}
                      </BlockStack>
                    </Box>
                  </Box>
                )}

              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
