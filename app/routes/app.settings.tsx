import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useFetcher, useLoaderData, useNavigation, useSubmit } from 'react-router';
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  InlineGrid,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
} from '@shopify/polaris';
import { useState } from 'react';
import { validateAppSettings } from '~/models/app-settings';
import { getAppSettings, saveAppSettings } from '~/services/app-settings.server';
import { authenticate, PLAN_ENTERPRISE, PLAN_PRO } from '../shopify.server';

const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST !== 'false';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);
  const settings = await getAppSettings(admin);

  let currentPlan = 'FREE';
  try {
    const checkResult = await billing.check({
      plans: [PLAN_PRO, PLAN_ENTERPRISE],
      isTest: BILLING_TEST_MODE,
    });
    if (checkResult.hasActivePayment) {
      currentPlan = checkResult.appSubscriptions.some((subscription) => subscription.name === PLAN_ENTERPRISE)
        ? 'ENTERPRISE'
        : 'PRO';
    }
  } catch {
    // Billing can be unavailable in local development; settings remain usable.
  }

  return { currentPlan, settings, billingTestMode: BILLING_TEST_MODE };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'save_settings') {
    const settings: unknown = {
      fallbackMode: formData.get('fallbackMode'),
      sharedMediaPosition: formData.get('sharedMediaPosition'),
      hideUnassignedMedia: formData.get('hideUnassignedMedia') === 'true',
    };
    if (!validateAppSettings(settings)) {
      return { success: false, error: 'Invalid storefront settings' };
    }

    try {
      await saveAppSettings(admin, settings);
      return { success: true, settingsSaved: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to save storefront settings',
      };
    }
  }

  const planToSubscribe = formData.get('plan');
  const returnUrl = new URL(
    '/app/settings',
    process.env.SHOPIFY_APP_URL || request.url,
  ).toString();

  if (planToSubscribe === 'PRO' || planToSubscribe === 'ENTERPRISE') {
    return billing.request({
      plan: planToSubscribe === 'PRO' ? PLAN_PRO : PLAN_ENTERPRISE,
      isTest: BILLING_TEST_MODE,
      returnUrl,
    });
  }

  if (planToSubscribe === 'FREE') {
    try {
      const checkResult = await billing.check({
        plans: [PLAN_PRO, PLAN_ENTERPRISE],
        isTest: BILLING_TEST_MODE,
      });
      for (const subscription of checkResult.appSubscriptions) {
        await billing.cancel({
          subscriptionId: subscription.id,
          isTest: BILLING_TEST_MODE,
          prorate: true,
        });
      }
    } catch {
      // Downgrading is already complete when there is no active subscription.
    }
    return { success: true, planChanged: true };
  }

  return { success: false, error: 'Unsupported settings action' };
};

export default function SettingsPage() {
  const { currentPlan, settings, billingTestMode } = useLoaderData<typeof loader>();
  const settingsFetcher = useFetcher<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [fallbackMode, setFallbackMode] = useState<string[]>([settings.fallbackMode]);
  const [sharedPosition, setSharedPosition] = useState<string[]>([settings.sharedMediaPosition]);
  const [hideUnassignedMedia, setHideUnassignedMedia] = useState(settings.hideUnassignedMedia);

  const changingPlan = navigation.formData?.get('plan');

  const changePlan = (plan: 'FREE' | 'PRO' | 'ENTERPRISE') => {
    const formData = new FormData();
    formData.set('intent', 'change_plan');
    formData.set('plan', plan);
    submit(formData, { method: 'post' });
  };

  const saveSettings = () => {
    const formData = new FormData();
    formData.set('intent', 'save_settings');
    formData.set('fallbackMode', fallbackMode[0]);
    formData.set('sharedMediaPosition', sharedPosition[0]);
    formData.set('hideUnassignedMedia', hideUnassignedMedia ? 'true' : 'false');
    settingsFetcher.submit(formData, { method: 'post' });
  };

  return (
    <Page title="App Settings & Subscription Plans" subtitle="Manage billing and global storefront gallery behavior">
      <BlockStack gap="500">
        {billingTestMode && (
          <Banner title="Billing test mode is enabled" tone="info">
            <p>Plan changes use Shopify test subscriptions until SHOPIFY_BILLING_TEST is set to false.</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">Subscription Plans & Billing</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Choose the plan that fits your catalog size and current mapping workflow.
            </Text>

            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              <PlanCard
                name="FREE"
                price="$0"
                active={currentPlan === 'FREE'}
                loading={changingPlan === 'FREE'}
                actionLabel={currentPlan === 'FREE' ? 'Current Plan' : 'Downgrade to Free'}
                features={['Up to 10 mapped products', 'Media mapping', 'Storefront gallery filtering']}
                onSelect={() => changePlan('FREE')}
              />
              <PlanCard
                name="PRO"
                price="$9.99"
                active={currentPlan === 'PRO'}
                loading={changingPlan === 'PRO'}
                actionLabel={currentPlan === 'PRO' ? 'Current Plan' : 'Upgrade to Pro'}
                features={['Up to 100 mapped products', 'Multi-option mapping', 'Videos, 3D, and shared media']}
                onSelect={() => changePlan('PRO')}
                badge="Popular"
              />
              <PlanCard
                name="ENTERPRISE"
                price="$29.99"
                active={currentPlan === 'ENTERPRISE'}
                loading={changingPlan === 'ENTERPRISE'}
                actionLabel={currentPlan === 'ENTERPRISE' ? 'Current Plan' : 'Upgrade to Enterprise'}
                features={['Unlimited mapped products', 'Bulk rules and CSV workflows', 'Setup assistance']}
                onSelect={() => changePlan('ENTERPRISE')}
              />
            </InlineGrid>
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Storefront Gallery Settings</Text>

                {settingsFetcher.data?.settingsSaved && (
                  <Banner title="Storefront settings saved" tone="success">
                    <p>The theme app extension will apply these defaults on product pages.</p>
                  </Banner>
                )}
                {settingsFetcher.data?.error && (
                  <Banner title="Unable to save settings" tone="critical">
                    <p>{settingsFetcher.data.error}</p>
                  </Banner>
                )}

                <ChoiceList
                  title="Fallback when a variant has no explicit media mapping"
                  choices={[
                    { label: 'Show all media', value: 'show_all' },
                    { label: 'Native featured media only', value: 'native_featured' },
                    { label: 'Shared media only', value: 'shared_only' },
                    { label: 'First configured group', value: 'first_group' },
                  ]}
                  selected={fallbackMode}
                  onChange={setFallbackMode}
                />

                <ChoiceList
                  title="Shared media position"
                  choices={[
                    { label: 'After group media', value: 'after' },
                    { label: 'Before group media', value: 'before' },
                  ]}
                  selected={sharedPosition}
                  onChange={setSharedPosition}
                />

                <Checkbox
                  label="Hide media that is not assigned to any group"
                  checked={hideUnassignedMedia}
                  onChange={setHideUnassignedMedia}
                />

                <Button
                  variant="primary"
                  onClick={saveSettings}
                  loading={settingsFetcher.state !== 'idle'}
                >
                  Save Storefront Settings
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick Checklist</Text>
                <List type="number">
                  <List.Item>Map media in Products Catalog.</List.Item>
                  <List.Item>Open Theme Editor → App Embeds.</List.Item>
                  <List.Item>Enable <b>Prism Variant Media</b>.</List.Item>
                  <List.Item>Test configured variants on the storefront.</List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  active: boolean;
  loading: boolean;
  actionLabel: string;
  features: string[];
  onSelect: () => void;
  badge?: string;
}

function PlanCard({
  name,
  price,
  active,
  loading,
  actionLabel,
  features,
  onSelect,
  badge,
}: PlanCardProps) {
  return (
    <Card roundedAbove="sm">
      <Box padding="400">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">{name}</Text>
            {active ? <Badge tone="success">Active Plan</Badge> : badge ? <Badge tone="attention">{badge}</Badge> : null}
          </InlineStack>

          <Text as="p" variant="heading2xl">
            {price} <Text as="span" variant="bodySm" tone="subdued">/ month</Text>
          </Text>

          <List type="bullet">
            {features.map((feature) => <List.Item key={feature}>{feature}</List.Item>)}
          </List>

          <Button
            variant="primary"
            onClick={onSelect}
            disabled={active}
            loading={loading}
            fullWidth
          >
            {actionLabel}
          </Button>
        </BlockStack>
      </Box>
    </Card>
  );
}
