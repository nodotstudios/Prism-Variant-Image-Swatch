import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useFetcher } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Button, Banner, DropZone, ProgressBar, InlineStack, Badge, Box, Divider, List } from '@shopify/polaris';
import { useState, useCallback, useEffect } from 'react';
import { authenticate } from '../shopify.server';
import { getProductsCatalog } from '~/services/graphql.server';
import { getProductGalleryMap, saveProductGalleryMap } from '~/services/metafields.server';
import { generateCSVExport } from '~/services/csv.server';
import { parseCSVImport } from '~/services/csv-import';
import { validateGalleryMap, type GalleryMapPayload } from '~/models/gallery-map.schema';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const catalog = await getProductsCatalog(admin, { first: 50 });

  const productsWithMaps = [];
  for (const prod of catalog.products) {
    const fullData = await getProductGalleryMap(admin, prod.id);
    if (fullData && fullData.galleryMap) {
      const hasGroupMedia = Object.values(fullData.galleryMap.groups || {}).some((group) => group.mediaIds.length > 0);
      const hasSharedMedia = fullData.galleryMap.sharedMediaIds && fullData.galleryMap.sharedMediaIds.length > 0;
      
      if (hasGroupMedia || hasSharedMedia) {
        productsWithMaps.push({ product: fullData.product, galleryMap: fullData.galleryMap });
      }
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
    const galleryMap: unknown = JSON.parse(payloadStr);
    if (!validateGalleryMap(galleryMap) || galleryMap.productId !== productId) {
      return { success: false, error: 'CSV contains an invalid product mapping' };
    }

    // Auto-enable for products updated via CSV import
    await saveProductGalleryMap(admin, productId, galleryMap, true);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    if (message.includes('Product not found') || message.includes('invalid')) {
      return { success: false, error: 'Product not found on this store' };
    }
    return { success: false, error: message };
  }
};

export default function CSVPage() {
  const { csvContent, count } = useLoaderData<typeof loader>();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [report, setReport] = useState<{ successes: number; failures: number; errors: string[] } | null>(null);
  
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const [importQueue, setImportQueue] = useState<[string, GalleryMapPayload][]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [successes, setSuccesses] = useState(0);
  const [failures, setFailures] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasStartedFetching, setHasStartedFetching] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [abortRequested, setAbortRequested] = useState(false);

  // Trigger when we are ready to process the NEXT item
  useEffect(() => {
    if (!importing || isFetching || isDone) return;
    
    if (abortRequested) {
      setImporting(false);
      setReport({ successes, failures, errors });
      return;
    }

    if (currentIndex < importQueue.length && importQueue.length > 0) {
      const [productId, payload] = importQueue[currentIndex];
      const formData = new FormData();
      formData.set('productId', productId);
      formData.set('galleryMap', JSON.stringify(payload));
      
      setIsFetching(true);
      fetcher.submit(formData, { method: 'post' });
    } else if (currentIndex === importQueue.length && importQueue.length > 0) {
      setIsDone(true);
      setImporting(false);
      setReport({ successes, failures, errors });
    }
  }, [abortRequested, currentIndex, errors, failures, fetcher, importQueue, importing, isDone, isFetching, successes]);

  // Listen to fetcher state transitions
  useEffect(() => {
    if (isFetching && fetcher.state !== 'idle') {
      setHasStartedFetching(true);
    }
    
    if (isFetching && hasStartedFetching && fetcher.state === 'idle') {
      // Fetcher just finished
      if (fetcher.data?.success) {
        setSuccesses(s => s + 1);
      } else {
        setFailures(f => f + 1);
        const pid = importQueue[currentIndex]?.[0] || 'Unknown';
        setErrors(e => [...e, `Product ${pid}: ${fetcher.data?.error || 'Server Error'}`]);
      }
      
      setProgress(currentIndex + 1);
      setCurrentIndex(c => c + 1);
      setHasStartedFetching(false);
      setIsFetching(false);
    }
  }, [currentIndex, fetcher.data, fetcher.state, hasStartedFetching, importQueue, isFetching]);

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
    (_dropFiles: File[], acceptedFiles: File[]) => {
      setFile(acceptedFiles[0]);
      setReport(null);
    },
    [],
  );

  const processImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setProgress(0);
    setReport(null);
    setAbortRequested(false);
    setIsFetching(false);
    setHasStartedFetching(false);
    setIsDone(false);
    setTotal(0);
    setImportQueue([]);
    setCurrentIndex(-1);
    setSuccesses(0);
    setFailures(0);
    setErrors([]);

    try {
      const text = await file.text();
      const queue = parseCSVImport(text);
      const totalProducts = queue.length;
      setTotal(totalProducts);
      setImportQueue(queue);
      
      if (totalProducts === 0) {
        setIsDone(true);
        setImporting(false);
        setReport({ successes: 0, failures: 0, errors: ['CSV contains no valid product mappings'] });
      } else {
        setCurrentIndex(0);
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to read the CSV file';
      setImporting(false);
      setReport({ successes: 0, failures: 1, errors: [message] });
    }
  };

  const cancelImport = () => {
    setAbortRequested(true);
  };

  return (
    <Page title="CSV Import & Export" subtitle="Backup, bulk edit, or migrate variant media mappings using CSV spreadsheets">
      <BlockStack gap="500">
        <Banner title="CSV Format Specifications" tone="info">
          <p>The import requires the exact same column format as the export. Uploading a CSV will automatically update mappings and enable the &quot;Prism Variant Media&quot; toggle for those products.</p>
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
                          <Badge tone="success">{`${report.successes} Successful`}</Badge>
                          <Badge tone={report.failures > 0 ? "critical" : "info"}>{`${report.failures} Failed`}</Badge>
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
