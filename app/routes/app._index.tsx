import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Button, InlineGrid, Badge, Banner, List, Box } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getDashboardStats } from '~/services/graphql.server';
import { ensureMetafieldDefinitions } from '~/services/metafields.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await ensureMetafieldDefinitions(admin);
  const stats = await getDashboardStats(admin);
  return { stats, shop: session.shop };
};

export default function Dashboard() {
  const { stats, shop } = useLoaderData<typeof loader>();

  const handleOpenThemeEditor = () => {
    const shopName = shop.replace('.myshopify.com', '');
    const url = `https://admin.shopify.com/store/${shopName}/themes/current/editor?context=apps`;
    window.open(url, '_blank');
  };

  return (
    <Page title="Prism Variant Image & Swatch Dashboard" subtitle="Assign multiple images, videos, swatches, and 3D models to product variant combinations">
      <BlockStack gap="500">
        <Banner title="Step 1 — Enable Theme App Embed Required" tone="warning">
          <p>
            To activate storefront variant media filtering, turn ON the <b>Prism Variant Media Embed</b> app embed in your Shopify Theme Editor.
          </p>
          <Box paddingBlockStart="200">
            <Button variant="primary" onClick={handleOpenThemeEditor}>
              Open Theme Editor & Enable App Embed
            </Button>
          </Box>
        </Banner>

        <Banner title="System Ready — Metafields Verified" tone="success">
          <p>Product metafield definitions (<code>prism_variant_media.gallery_map</code> and <code>prism_variant_media.enabled</code>) are registered with public storefront access.</p>
        </Banner>

        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">Total Products</Text>
              <Text as="p" variant="headingLg">{stats.totalProducts.toString()}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">Configured Products</Text>
              <InlineGrid columns="auto auto" gap="200">
                <Text as="p" variant="headingLg">{stats.configuredProducts.toString()}</Text>
                <Badge tone="success">Active</Badge>
              </InlineGrid>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">Unconfigured Products</Text>
              <InlineGrid columns="auto auto" gap="200">
                <Text as="p" variant="headingLg">{stats.unconfiguredProducts.toString()}</Text>
                <Badge tone="attention">Pending</Badge>
              </InlineGrid>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Actions & Management</Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                  <Link to="/app/products">
                    <Button variant="primary" fullWidth size="large">
                      Configure Products Catalog
                    </Button>
                  </Link>
                  <Link to="/app/bulk-mapper">
                    <Button fullWidth size="large">
                      Bulk Mapper Tool
                    </Button>
                  </Link>
                  <Link to="/app/csv">
                    <Button fullWidth size="large">
                      CSV Import / Export
                    </Button>
                  </Link>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Setup Checklist</Text>
                <List type="bullet">
                  <List.Item>Step 1: Enable <b>Prism Variant Media</b> App Embed in Theme Editor</List.Item>
                  <List.Item>Step 2: Assign media to product variants in Product Catalog</List.Item>
                  <List.Item>Step 3: Test variant option switches on storefront product page</List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
