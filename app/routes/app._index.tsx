import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useAppBridge } from '@shopify/app-bridge-react';
import { Page, Layout, Card, BlockStack, Text, Button, InlineGrid, Badge, Banner, List, Box } from '@shopify/polaris';
import { useCallback, useEffect, useState } from 'react';
import { authenticate } from '../shopify.server';
import db from '~/db.server';
import {
  evaluateFoundationReadiness,
  getAppEmbedActivationStatus,
  type AppEmbedActivationStatus,
} from '~/models/app-readiness';
import { APP_CONFIG } from '~/config/app.config';
import { getDashboardStats } from '~/services/graphql.server';
import { ensureMetafieldDefinitions } from '~/services/metafields.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const apiKey = process.env.SHOPIFY_API_KEY?.trim();

  const [definitionSetup, stats, persistedSession] = await Promise.all([
    ensureMetafieldDefinitions(admin, { shop: session.shop }),
    getDashboardStats(admin),
    db.session.findUnique({ where: { id: session.id }, select: { id: true } }).catch(() => null),
  ]);

  const readiness = evaluateFoundationReadiness({
    apiKey,
    graphqlReady: definitionSetup.graphqlReady,
    metafieldsReady: definitionSetup.ready,
    session: {
      id: session.id,
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope,
    },
    sessionPersisted: Boolean(persistedSession),
  });

  return { stats, readiness, definitionSetup };
};

export default function Dashboard() {
  const { stats, readiness, definitionSetup } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [embedStatus, setEmbedStatus] = useState<AppEmbedActivationStatus | 'checking'>('checking');

  const refreshEmbedStatus = useCallback(async () => {
    try {
      const extensions = await shopify.app.extensions();
      setEmbedStatus(getAppEmbedActivationStatus(
        extensions,
        APP_CONFIG.themeExtension.blockHandle,
      ));
    } catch {
      setEmbedStatus('unknown');
    }
  }, [shopify]);

  useEffect(() => {
    void refreshEmbedStatus();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshEmbedStatus();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshEmbedStatus);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshEmbedStatus);
    };
  }, [refreshEmbedStatus]);

  const handleOpenThemeEditor = () => {
    if (readiness.appEmbed.deepLink) {
      window.open(readiness.appEmbed.deepLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Page title="Prism Variant Media Dashboard" subtitle="Assign multiple images, videos, and 3D models to product variant combinations">
      <BlockStack gap="500">
        {readiness.ready ? (
          <Banner title="Phase 1 foundation is ready" tone="success">
            <p>Shopify GraphQL, PostgreSQL sessions, required scopes, and product metafield definitions passed their readiness checks.</p>
          </Banner>
        ) : (
          <Banner title="Foundation setup needs attention" tone="critical">
            <List type="bullet">
              {readiness.issues.map((issue) => <List.Item key={issue}>{issue}</List.Item>)}
            </List>
          </Banner>
        )}

        {embedStatus === 'active' ? (
          <Banner title="Theme app embed is active" tone="success">
            <p>Shopify confirms that Prism Variant Media is enabled on the published theme.</p>
          </Banner>
        ) : embedStatus === 'checking' ? (
          <Banner title="Checking theme app embed" tone="info">
            <p>Checking the published theme activation status with Shopify.</p>
          </Banner>
        ) : (
          <Banner
            title={embedStatus === 'available' ? 'Enable the theme app embed' : 'Theme app embed status unavailable'}
            tone={embedStatus === 'available' ? 'warning' : 'info'}
          >
            <p>
              {embedStatus === 'available'
                ? 'Prism Variant Media is available but not active on the published theme.'
                : 'Shopify could not confirm the embed status. You can verify it in the published theme editor.'}
            </p>
            <Box paddingBlockStart="200">
              <Button
                variant="primary"
                onClick={handleOpenThemeEditor}
                disabled={!readiness.appEmbed.deepLink}
              >
                Open Theme Editor
              </Button>
            </Box>
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Foundation Readiness</Text>
            <InlineGrid columns={{ xs: 1, sm: 4 }} gap="300">
              <ReadinessItem label="GraphQL Admin API" ready={readiness.graphqlReady} />
              <ReadinessItem label="PostgreSQL session" ready={readiness.sessionPersisted && readiness.sessionReady} />
              <ReadinessItem label="Required scopes" ready={readiness.scopes.ready} />
              <ReadinessItem label="Metafield definitions" ready={readiness.metafieldsReady} />
            </InlineGrid>
            <Text as="p" variant="bodySm" tone="subdued">
              Metafields: {definitionSetup.definitions.map((definition) => `${definition.key} (${definition.action})`).join(', ')}
            </Text>
            {definitionSetup.definitions.some((definition) => !definition.ready) && (
              <List type="bullet">
                {definitionSetup.definitions
                  .filter((definition) => !definition.ready)
                  .map((definition) => (
                    <List.Item key={definition.key}>
                      <b>{definition.key}:</b> {definition.message ?? 'Definition is not ready.'}
                    </List.Item>
                  ))}
              </List>
            )}
          </BlockStack>
        </Card>

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

function ReadinessItem({ label, ready }: { label: string; ready: boolean }) {
  return (
    <BlockStack gap="100">
      <Text as="p" variant="bodyMd">{label}</Text>
      <Badge tone={ready ? 'success' : 'critical'}>{ready ? 'Ready' : 'Needs attention'}</Badge>
    </BlockStack>
  );
}
