import { APP_CONFIG } from '~/config/app.config';

export interface ScopeReadiness {
  ready: boolean;
  granted: string[];
  missing: string[];
}

export interface SessionReadinessInput {
  id?: string | null;
  shop?: string | null;
  accessToken?: string | null;
  scope?: string | string[] | null;
}

export interface FoundationReadinessInput {
  apiKey?: string | null;
  graphqlReady: boolean;
  metafieldsReady: boolean;
  session: SessionReadinessInput;
  sessionPersisted: boolean;
}

export interface FoundationReadiness {
  ready: boolean;
  graphqlReady: boolean;
  metafieldsReady: boolean;
  sessionReady: boolean;
  sessionPersisted: boolean;
  scopes: ScopeReadiness;
  appEmbed: {
    configured: boolean;
    activationRequired: true;
    deepLink: string | null;
  };
  issues: string[];
}

export type AppEmbedActivationStatus = 'active' | 'available' | 'unavailable' | 'unknown';

interface ExtensionActivationInput {
  handle?: string;
  status?: string;
  target?: string;
}

interface ExtensionInfoInput {
  type?: string;
  activations?: ExtensionActivationInput[];
}

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function parseGrantedScopes(scope: string | string[] | null | undefined): string[] {
  const values = Array.isArray(scope) ? scope : (scope ?? '').split(',');
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))).sort();
}

export function evaluateScopes(scope: string | string[] | null | undefined): ScopeReadiness {
  const granted = parseGrantedScopes(scope);
  const grantedSet = new Set(granted);
  const missing = APP_CONFIG.requiredScopes.filter((requiredScope) => {
    if (grantedSet.has(requiredScope)) return false;
    if (!requiredScope.startsWith('read_')) return true;

    const impliedWriteScope = `write_${requiredScope.slice('read_'.length)}`;
    return !grantedSet.has(impliedWriteScope);
  });

  return {
    ready: missing.length === 0,
    granted,
    missing,
  };
}

export function createAppEmbedDeepLink(shop: string | null | undefined, apiKey: string | null | undefined): string | null {
  const normalizedShop = shop?.trim().toLowerCase();
  const normalizedApiKey = apiKey?.trim();
  if (!normalizedShop || !SHOP_DOMAIN_PATTERN.test(normalizedShop) || !normalizedApiKey) return null;

  const activationId = `${encodeURIComponent(normalizedApiKey)}/${APP_CONFIG.themeExtension.blockHandle}`;
  return `https://${normalizedShop}/admin/themes/current/editor?context=apps&template=product&activateAppId=${activationId}`;
}

export function getAppEmbedActivationStatus(
  extensions: ExtensionInfoInput[],
  blockHandle: string,
): AppEmbedActivationStatus {
  const activation = extensions
    .filter((extension) => extension.type === 'theme_app_extension')
    .flatMap((extension) => extension.activations ?? [])
    .find((item) => item.handle === blockHandle && ['head', 'body', 'compliance_head'].includes(item.target ?? ''));

  if (!activation) return 'unknown';
  if (activation.status === 'active') return 'active';
  if (activation.status === 'available') return 'available';
  if (activation.status === 'unavailable') return 'unavailable';
  return 'unknown';
}

export function evaluateFoundationReadiness(input: FoundationReadinessInput): FoundationReadiness {
  const sessionReady = Boolean(input.session.id && input.session.shop && input.session.accessToken);
  const scopes = evaluateScopes(input.session.scope);
  const deepLink = createAppEmbedDeepLink(input.session.shop, input.apiKey);
  const appEmbedConfigured = deepLink !== null;
  const issues: string[] = [];

  if (!input.graphqlReady) issues.push('The Shopify GraphQL Admin API is unavailable.');
  if (!input.metafieldsReady) issues.push('The required product metafield definitions are not ready.');
  if (!sessionReady) issues.push('The authenticated Shopify session is incomplete.');
  if (!input.sessionPersisted) issues.push('The authenticated session is not persisted in PostgreSQL.');
  if (!scopes.ready) issues.push(`Missing Shopify scopes: ${scopes.missing.join(', ')}.`);
  if (!appEmbedConfigured) issues.push('The theme app embed activation link cannot be generated.');

  return {
    ready: issues.length === 0,
    graphqlReady: input.graphqlReady,
    metafieldsReady: input.metafieldsReady,
    sessionReady,
    sessionPersisted: input.sessionPersisted,
    scopes,
    appEmbed: {
      configured: appEmbedConfigured,
      activationRequired: true,
      deepLink,
    },
    issues,
  };
}
