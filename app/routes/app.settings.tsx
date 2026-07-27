import type { LoaderFunctionArgs } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Banner, ChoiceList, List } from '@shopify/polaris';
import { useState } from 'react';
import { authenticate } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {};
};

export default function SettingsPage() {
  const [fallbackMode, setFallbackMode] = useState(['show_all']);
  const [sharedPosition, setSharedPosition] = useState(['after']);

  return (
    <Page title="App Settings & Onboarding" subtitle="Configure global storefront gallery behaviors and theme options">
      <BlockStack gap="500">
        <Banner title="Horizon Theme Integration Active" tone="success">
          <p>Theme App Extension adapter is targeted for the <b>Horizon</b> theme with fallback support for <b>Dawn</b> and generic themes.</p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Storefront Fallback Settings</Text>
                <Text as="h3" variant="headingSm">Unassigned Variant Behavior:</Text>
                <ChoiceList
                  title="Fallback Mode when a variant has no explicit media mapping:"
                  choices={[
                    { label: 'Show All Media (Recommended - Fail Open)', value: 'show_all' },
                    { label: 'Native Featured Media Only', value: 'native_featured' },
                    { label: 'Shared Media Only', value: 'shared_only' },
                    { label: 'First Configured Group Media', value: 'first_group' },
                  ]}
                  selected={fallbackMode}
                  onChange={setFallbackMode}
                />

                <ChoiceList
                  title="Shared Media Position:"
                  choices={[
                    { label: 'After Group Media Items (End of Gallery)', value: 'after' },
                    { label: 'Before Group Media Items (Beginning of Gallery)', value: 'before' },
                  ]}
                  selected={sharedPosition}
                  onChange={setSharedPosition}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Onboarding Steps</Text>
                <List type="number">
                  <List.Item>Ensure product metafield definitions are active (Done).</List.Item>
                  <List.Item>Map images/videos to variant combinations in Product Catalog.</List.Item>
                  <List.Item>Open Online Store -&gt; Themes -&gt; Customize Horizon Theme.</List.Item>
                  <List.Item>Under App Embeds, enable <b>Prism Variant Media Embed</b>.</List.Item>
                  <List.Item>Save theme changes and preview product page variant switching!</List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
