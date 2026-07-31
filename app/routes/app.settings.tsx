import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { Form, useActionData, useLoaderData } from 'react-router';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  ChoiceList,
  List,
  Button,
  InlineGrid,
  Badge,
  Box,
} from '@shopify/polaris';
import { useState } from 'react';
import { authenticate, PLAN_PRO, PLAN_ENTERPRISE } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);

  let currentPlan = 'FREE';
  try {
    const checkResult = await billing.check({
      plans: [PLAN_PRO, PLAN_ENTERPRISE],
      isTest: true,
    });
    if (checkResult.hasActivePayment) {
      if (checkResult.appSubscriptions.some((sub) => sub.name === PLAN_ENTERPRISE)) {
        currentPlan = 'ENTERPRISE';
      } else if (checkResult.appSubscriptions.some((sub) => sub.name === PLAN_PRO)) {
        currentPlan = 'PRO';
      }
    }
  } catch (e) {
    // Billing check unavailable in dev/test environment
  }

  return {
    currentPlan,
    shop: session.shop,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const planToSubscribe = formData.get('plan');

  const apiKey = process.env.SHOPIFY_API_KEY || "b524766caf5859eb3910305d16617068";
  const returnUrl = `https://${session.shop}/admin/apps/${apiKey}/app/settings`;

  if (planToSubscribe === 'PRO') {
    return await billing.request({
      plan: PLAN_PRO,
      isTest: true,
      returnUrl,
    });
  }

  if (planToSubscribe === 'ENTERPRISE') {
    return await billing.request({
      plan: PLAN_ENTERPRISE,
      isTest: true,
      returnUrl,
    });
  }

  return { success: true };
};

export default function SettingsPage() {
  const { currentPlan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [fallbackMode, setFallbackMode] = useState(['show_all']);
  const [sharedPosition, setSharedPosition] = useState(['after']);

  return (
    <Page title="App Settings & Subscription Plans" subtitle="Manage your subscription tier, billing, and global storefront behaviors">
      <BlockStack gap="500">
        {actionData?.error && (
          <Banner title="Subscription Request Issue" tone="warning">
            <p>{actionData.error}</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">Subscription Plans & Billing</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Choose the plan that fits your catalog size and automation requirements.
            </Text>

            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              {/* FREE PLAN */}
              <Card roundedAbove="sm">
                <Box padding="400">
                  <BlockStack gap="300">
                    <InlineGrid columns="2" align="space-between">
                      <Text as="h3" variant="headingMd">FREE</Text>
                      {currentPlan === 'FREE' && <Badge tone="success">Active Plan</Badge>}
                    </InlineGrid>

                    <Text as="p" variant="heading2xl">$0 <Text as="span" variant="bodySm" tone="subdued">/ month</Text></Text>

                    <List type="bullet">
                      <List.Item>Up to <b>10 Mapped Products</b></List.Item>
                      <List.Item>Single Visual Option Mapping</List.Item>
                      <List.Item>Zero-Latency Storefront CDN</List.Item>
                      <List.Item>Standard Support</List.Item>
                    </List>

                    <Button
                      disabled={currentPlan === 'FREE'}
                      fullWidth
                    >
                      {currentPlan === 'FREE' ? 'Current Plan' : 'Downgrade to Free'}
                    </Button>
                  </BlockStack>
                </Box>
              </Card>

              {/* PRO PLAN */}
              <Card roundedAbove="sm">
                <Box padding="400">
                  <BlockStack gap="300">
                    <InlineGrid columns="2" align="space-between">
                      <Text as="h3" variant="headingMd">PRO</Text>
                      {currentPlan === 'PRO' ? (
                        <Badge tone="success">Active Plan</Badge>
                      ) : (
                        <Badge tone="attention">Popular</Badge>
                      )}
                    </InlineGrid>

                    <Text as="p" variant="heading2xl">$9.99 <Text as="span" variant="bodySm" tone="subdued">/ month</Text></Text>

                    <List type="bullet">
                      <List.Item>Up to <b>100 Mapped Products</b></List.Item>
                      <List.Item>Multi-Option Mapping</List.Item>
                      <List.Item>Videos &amp; 3D Models Support</List.Item>
                      <List.Item>Shared Media Support</List.Item>
                      <List.Item>Priority Support</List.Item>
                    </List>

                    <Form method="post">
                      <input type="hidden" name="plan" value="PRO" />
                      <Button
                        variant="primary"
                        submit
                        disabled={currentPlan === 'PRO'}
                        fullWidth
                      >
                        {currentPlan === 'PRO' ? 'Current Plan' : 'Upgrade to Pro'}
                      </Button>
                    </Form>
                  </BlockStack>
                </Box>
              </Card>

              {/* ENTERPRISE PLAN */}
              <Card roundedAbove="sm">
                <Box padding="400">
                  <BlockStack gap="300">
                    <InlineGrid columns="2" align="space-between">
                      <Text as="h3" variant="headingMd">ENTERPRISE</Text>
                      {currentPlan === 'ENTERPRISE' && <Badge tone="success">Active Plan</Badge>}
                    </InlineGrid>

                    <Text as="p" variant="heading2xl">$29.99 <Text as="span" variant="bodySm" tone="subdued">/ month</Text></Text>

                    <List type="bullet">
                      <List.Item><b>UNLIMITED Mapped Products</b></List.Item>
                      <List.Item>Bulk Automated Pattern Rules</List.Item>
                      <List.Item>CSV Import / Export Batch</List.Item>
                      <List.Item>Multi-Option &amp; Shared Media</List.Item>
                      <List.Item>1-on-1 Setup Assistance</List.Item>
                    </List>

                    <Form method="post">
                      <input type="hidden" name="plan" value="ENTERPRISE" />
                      <Button
                        variant="primary"
                        submit
                        disabled={currentPlan === 'ENTERPRISE'}
                        fullWidth
                      >
                        {currentPlan === 'ENTERPRISE' ? 'Current Plan' : 'Upgrade to Enterprise'}
                      </Button>
                    </Form>
                  </BlockStack>
                </Box>
              </Card>
            </InlineGrid>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Storefront Fallback Settings</Text>
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
                <Text as="h2" variant="headingMd">Quick Checklist</Text>
                <List type="number">
                  <List.Item>Select your subscription plan above.</List.Item>
                  <List.Item>Map images/videos in Products Catalog.</List.Item>
                  <List.Item>Open Theme Editor -&gt; App Embeds.</List.Item>
                  <List.Item>Enable <b>Prism Variant Swatches</b>.</List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
