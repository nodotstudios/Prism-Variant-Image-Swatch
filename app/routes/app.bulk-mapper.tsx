import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useSubmit, useNavigation } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Button, Banner, Box, InlineStack, Badge } from '@shopify/polaris';
import { useState } from 'react';
import { authenticate } from '../shopify.server';
import { getProductsCatalog } from '~/services/graphql.server';
import { getProductGalleryMap, saveProductGalleryMap } from '~/services/metafields.server';
import { applyBulkRulesToProduct, BulkRule } from '~/services/bulk-rules.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const catalog = await getProductsCatalog(admin, { first: 50 });
  return { catalog };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const rulesJson = formData.get('rules') as string;

  if (!rulesJson) {
    return { success: false, error: 'No rules provided' };
  }

  const rules: BulkRule[] = JSON.parse(rulesJson);
  const catalog = await getProductsCatalog(admin, { first: 50 });

  let updatedCount = 0;

  for (const productSummary of catalog.products) {
    const fullData = await getProductGalleryMap(admin, productSummary.id);
    if (!fullData) continue;

    const { product, galleryMap, enabled } = fullData;
    const { updatedGalleryMap, matchedCount } = applyBulkRulesToProduct(product, galleryMap, rules);

    if (matchedCount > 0) {
      await saveProductGalleryMap(admin, productSummary.id, updatedGalleryMap, enabled);
      updatedCount++;
    }
  }

  return { success: true, updatedCount };
};

export default function BulkMapper() {
  const { catalog } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isExecuting = navigation.state === 'submitting';

  const [rules, setRules] = useState<BulkRule[]>([
    {
      id: '1',
      patternType: 'filename',
      matchValue: 'platinum-petal',
      targetGroupLabel: 'Platinum / Petal',
      optionValues: { Color: 'Platinum', 'Band Style': 'Petal' },
    },
    {
      id: '2',
      patternType: 'filename',
      matchValue: 'shared',
      targetGroupLabel: 'Shared Media',
      optionValues: {},
      isSharedMedia: true,
    },
  ]);

  const handleRunBulkRules = () => {
    const formData = new FormData();
    formData.set('rules', JSON.stringify(rules));
    submit(formData, { method: 'post' });
  };

  return (
    <Page title="Bulk Media Mapper" subtitle="Automate multi-variant media mapping for 1,000+ jewellery products using pattern rules">
      <BlockStack gap="500">
        <Banner title="Batch Automation Rules" tone="info">
          <p>Rules scan media filenames and alt-text tags across your catalog to map images, videos, and 3D models to specific visual combinations automatically.</p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Active Bulk Rules</Text>
                <Text as="h3" variant="headingSm">Configured Rules ({rules.length.toString()}):</Text>

                {rules.map((rule, idx) => (
                  <Box key={rule.id} padding="300" borderWidth="025" borderColor="border-secondary" borderRadius="200">
                    <InlineStack align="space-between">
                      <BlockStack gap="100">
                        <Text as="p" fontWeight="bold">Rule #{idx + 1}: Match {rule.patternType} containing "{rule.matchValue}"</Text>
                        <Text as="p" tone="subdued">
                          {rule.isSharedMedia ? 'Assign as Shared Media (All variants)' : `Target Group: ${rule.targetGroupLabel}`}
                        </Text>
                      </BlockStack>
                      <Badge tone={rule.isSharedMedia ? 'attention' : 'info'}>
                        {rule.isSharedMedia ? 'Shared Media' : 'Group Match'}
                      </Badge>
                    </InlineStack>
                  </Box>
                ))}

                <InlineStack gap="300">
                  <Button variant="primary" onClick={handleRunBulkRules} loading={isExecuting}>
                    Execute Rules on Catalog Products
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
