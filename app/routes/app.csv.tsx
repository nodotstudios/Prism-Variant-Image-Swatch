import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Button, Banner } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getProductsCatalog } from '~/services/graphql.server';
import { getProductGalleryMap } from '~/services/metafields.server';
import { generateCSVExport } from '~/services/csv.server';

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

export default function CSVPage() {
  const { csvContent, count } = useLoaderData<typeof loader>();

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

  return (
    <Page title="CSV Import & Export" subtitle="Backup, bulk edit, or migrate variant media mappings using CSV spreadsheets">
      <BlockStack gap="500">
        <Banner title="CSV Export Format" tone="info">
          <p>CSV export includes Product Handle, Product ID, Visual Options, Variant ID, Group Key, Group Label, Media IDs, and Shared Media IDs. Formula injection protection is enabled.</p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Export Catalog Mappings</Text>
                <Text as="h3" variant="headingSm">Export ({count.toString()} Products Loaded):</Text>
                <Button variant="primary" onClick={handleDownloadCSV}>
                  Download CSV Export File
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
