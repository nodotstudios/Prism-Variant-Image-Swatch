import { APP_CONFIG } from '~/config/app.config';
import { GalleryMapPayload, validateGalleryMap, createEmptyGalleryMap } from '~/models/gallery-map.schema';
import type { ProductDetails } from '~/types/product';
import type {
  AdminGraphQLClient,
  GraphQLRequestError,
  GraphQLUserError,
} from '~/types/shopify';

const METAFIELD_DEFINITION_SPECS = [
  {
    name: 'Prism Variant Media Gallery Map',
    namespace: APP_CONFIG.metafields.namespace,
    key: APP_CONFIG.metafields.keyGalleryMap,
    type: 'json',
    description: 'Stores variant to media item mapping for dynamic storefront gallery switching',
  },
  {
    name: 'Prism Variant Media Enabled',
    namespace: APP_CONFIG.metafields.namespace,
    key: APP_CONFIG.metafields.keyEnabled,
    type: 'boolean',
    description: 'Enables custom variant media filtering for this product',
  },
] as const;

const DEFINITION_OWNER_TYPE = 'PRODUCT';
const DEFINITION_STOREFRONT_ACCESS = 'PUBLIC_READ';
const DEFINITION_CACHE_TTL_MS = 5 * 60 * 1000;

type MetafieldDefinitionSpec = (typeof METAFIELD_DEFINITION_SPECS)[number];

interface MetafieldDefinitionNode {
  id: string;
  name: string;
  namespace: string;
  key: string;
  description?: string | null;
  ownerType: string;
  type: { name: string };
  access: {
    storefront: string;
  };
}

interface MetafieldDefinitionsResponse {
  data?: {
    metafieldDefinitions?: {
      nodes: MetafieldDefinitionNode[];
    } | null;
  };
  errors?: GraphQLRequestError[];
}

interface MetafieldDefinitionMutationResponse {
  data?: {
    metafieldDefinitionCreate?: {
      createdDefinition?: MetafieldDefinitionNode | null;
      userErrors?: GraphQLUserError[];
    } | null;
    metafieldDefinitionUpdate?: {
      updatedDefinition?: MetafieldDefinitionNode | null;
      userErrors?: GraphQLUserError[];
    } | null;
  };
  errors?: GraphQLRequestError[];
}

export interface MetafieldDefinitionReadiness {
  key: string;
  ready: boolean;
  action: 'ready' | 'created' | 'updated' | 'error';
  message?: string;
}

export interface MetafieldDefinitionSetupResult {
  ready: boolean;
  graphqlReady: boolean;
  definitions: MetafieldDefinitionReadiness[];
}

interface EnsureMetafieldDefinitionsOptions {
  shop?: string;
  force?: boolean;
}

interface CachedDefinitionSetup {
  expiresAt: number;
  result: MetafieldDefinitionSetupResult;
}

const definitionSetupCache = new Map<string, CachedDefinitionSetup>();

interface ProductGalleryMapResponse {
  data?: { product?: ProductDetails | null };
}

interface MetafieldsSetResponse {
  data?: {
    metafieldsSet?: {
      userErrors?: GraphQLUserError[];
    } | null;
  };
}

function definitionInput(spec: MetafieldDefinitionSpec, includeType: boolean) {
  return {
    name: spec.name,
    namespace: spec.namespace,
    key: spec.key,
    ...(includeType ? { type: spec.type } : {}),
    description: spec.description,
    ownerType: DEFINITION_OWNER_TYPE,
    access: {
      storefront: DEFINITION_STOREFRONT_ACCESS,
    },
  };
}

function definitionNeedsUpdate(node: MetafieldDefinitionNode, spec: MetafieldDefinitionSpec): boolean {
  return node.name !== spec.name
    || node.description !== spec.description
    || node.access.storefront !== DEFINITION_STOREFRONT_ACCESS;
}

function graphQLErrorMessage(errors: GraphQLRequestError[] | undefined): string | null {
  if (!errors?.length) return null;
  return errors.map((error) => error.message).join('; ');
}

function userErrorMessage(errors: GraphQLUserError[] | undefined): string | null {
  if (!errors?.length) return null;
  return errors.map((error) => error.message).join('; ');
}

function failedDefinitionResults(message: string): MetafieldDefinitionReadiness[] {
  return METAFIELD_DEFINITION_SPECS.map((spec) => ({
    key: spec.key,
    ready: false,
    action: 'error',
    message,
  }));
}

async function createMetafieldDefinition(
  admin: AdminGraphQLClient,
  spec: MetafieldDefinitionSpec,
): Promise<MetafieldDefinitionReadiness> {
  const response = await admin.graphql(
    `#graphql
      mutation CreatePrismMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
            namespace
            key
            description
            ownerType
            type { name }
            access { storefront }
          }
          userErrors { field message code }
        }
      }
    `,
    { variables: { definition: definitionInput(spec, true) } },
  );
  const json = (await response.json()) as MetafieldDefinitionMutationResponse;
  const error = graphQLErrorMessage(json.errors)
    ?? userErrorMessage(json.data?.metafieldDefinitionCreate?.userErrors);

  if (!response.ok || error || !json.data?.metafieldDefinitionCreate?.createdDefinition) {
    return {
      key: spec.key,
      ready: false,
      action: 'error',
      message: error ?? `Shopify returned HTTP ${response.status} while creating the definition.`,
    };
  }

  return { key: spec.key, ready: true, action: 'created' };
}

async function updateMetafieldDefinition(
  admin: AdminGraphQLClient,
  spec: MetafieldDefinitionSpec,
): Promise<MetafieldDefinitionReadiness> {
  const response = await admin.graphql(
    `#graphql
      mutation UpdatePrismMetafieldDefinition($definition: MetafieldDefinitionUpdateInput!) {
        metafieldDefinitionUpdate(definition: $definition) {
          updatedDefinition {
            id
            name
            namespace
            key
            description
            ownerType
            type { name }
            access { storefront }
          }
          userErrors { field message code }
        }
      }
    `,
    { variables: { definition: definitionInput(spec, false) } },
  );
  const json = (await response.json()) as MetafieldDefinitionMutationResponse;
  const error = graphQLErrorMessage(json.errors)
    ?? userErrorMessage(json.data?.metafieldDefinitionUpdate?.userErrors);

  if (!response.ok || error || !json.data?.metafieldDefinitionUpdate?.updatedDefinition) {
    return {
      key: spec.key,
      ready: false,
      action: 'error',
      message: error ?? `Shopify returned HTTP ${response.status} while updating the definition.`,
    };
  }

  return { key: spec.key, ready: true, action: 'updated' };
}

async function reconcileMetafieldDefinitions(
  admin: AdminGraphQLClient,
): Promise<MetafieldDefinitionSetupResult> {
  let response: Response;
  try {
    response = await admin.graphql(
      `#graphql
        query GetPrismMetafieldDefinitions($namespace: String!) {
          metafieldDefinitions(first: 10, ownerType: PRODUCT, namespace: $namespace) {
            nodes {
              id
              name
              namespace
              key
              description
              ownerType
              type { name }
              access { storefront }
            }
          }
        }
      `,
      { variables: { namespace: APP_CONFIG.metafields.namespace } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to query Shopify metafield definitions.';
    return { ready: false, graphqlReady: false, definitions: failedDefinitionResults(message) };
  }

  let json: MetafieldDefinitionsResponse;
  try {
    json = (await response.json()) as MetafieldDefinitionsResponse;
  } catch {
    const message = 'Shopify returned an unreadable metafield definition response.';
    return { ready: false, graphqlReady: false, definitions: failedDefinitionResults(message) };
  }

  const queryError = graphQLErrorMessage(json.errors);
  const nodes = json.data?.metafieldDefinitions?.nodes;
  if (!response.ok || queryError || !nodes) {
    const message = queryError ?? `Shopify returned HTTP ${response.status} while checking definitions.`;
    return { ready: false, graphqlReady: false, definitions: failedDefinitionResults(message) };
  }

  const definitions: MetafieldDefinitionReadiness[] = [];
  for (const spec of METAFIELD_DEFINITION_SPECS) {
    const existing = nodes.find((node) => node.namespace === spec.namespace && node.key === spec.key);

    try {
      if (!existing) {
        definitions.push(await createMetafieldDefinition(admin, spec));
      } else if (existing.type.name !== spec.type) {
        definitions.push({
          key: spec.key,
          ready: false,
          action: 'error',
          message: `Expected type ${spec.type}, but Shopify has ${existing.type.name}.`,
        });
      } else if (definitionNeedsUpdate(existing, spec)) {
        definitions.push(await updateMetafieldDefinition(admin, spec));
      } else {
        definitions.push({ key: spec.key, ready: true, action: 'ready' });
      }
    } catch (error: unknown) {
      definitions.push({
        key: spec.key,
        ready: false,
        action: 'error',
        message: error instanceof Error ? error.message : 'Unable to reconcile this definition.',
      });
    }
  }

  return {
    ready: definitions.every((definition) => definition.ready),
    graphqlReady: true,
    definitions,
  };
}

export async function ensureMetafieldDefinitions(
  admin: AdminGraphQLClient,
  options: EnsureMetafieldDefinitionsOptions = {},
): Promise<MetafieldDefinitionSetupResult> {
  const cacheKey = options.shop?.trim().toLowerCase();
  const cached = cacheKey ? definitionSetupCache.get(cacheKey) : undefined;
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await reconcileMetafieldDefinitions(admin);
  if (cacheKey && result.ready) {
    definitionSetupCache.set(cacheKey, {
      expiresAt: Date.now() + DEFINITION_CACHE_TTL_MS,
      result,
    });
  }
  return result;
}

export async function getProductGalleryMap(admin: AdminGraphQLClient, productId: string) {
  const query = `#graphql
    query GetProductWithMetafields($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        featuredImage {
          url
          altText
        }
        options {
          id
          name
          values
        }
        variants(first: 250) {
          nodes {
            id
            title
            selectedOptions {
              name
              value
            }
            image {
              id
              url
            }
          }
        }
        media(first: 250) {
          nodes {
            id
            mediaContentType
            alt
            ... on MediaImage {
              image {
                url
              }
            }
            ... on Video {
              sources {
                url
              }
            }
            ... on ExternalVideo {
              embedUrl
            }
            ... on Model3d {
              sources {
                url
              }
            }
          }
        }
        galleryMapMetafield: metafield(
          namespace: "${APP_CONFIG.metafields.namespace}",
          key: "${APP_CONFIG.metafields.keyGalleryMap}"
        ) {
          id
          value
        }
        enabledMetafield: metafield(
          namespace: "${APP_CONFIG.metafields.namespace}",
          key: "${APP_CONFIG.metafields.keyEnabled}"
        ) {
          id
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query, { variables: { id: productId } });
  const responseJson = (await response.json()) as ProductGalleryMapResponse;
  const product = responseJson.data?.product;

  if (!product) return null;

  let galleryMap: GalleryMapPayload;
  let enabled = true;

  if (product.enabledMetafield?.value !== undefined) {
    enabled = product.enabledMetafield.value === 'true';
  }

  if (product.galleryMapMetafield?.value) {
    try {
      const parsed = JSON.parse(product.galleryMapMetafield.value);
      if (validateGalleryMap(parsed)) {
        galleryMap = parsed;
      } else {
        galleryMap = createEmptyGalleryMap(productId);
      }
    } catch {
      galleryMap = createEmptyGalleryMap(productId);
    }
  } else {
    galleryMap = createEmptyGalleryMap(productId);
  }

  return {
    product,
    galleryMap,
    enabled,
  };
}

export async function saveProductGalleryMap(
  admin: AdminGraphQLClient,
  productId: string,
  galleryMap: GalleryMapPayload,
  enabled: boolean,
  options: { shop?: string } = {},
) {
  if (!validateGalleryMap(galleryMap) || galleryMap.productId !== productId) {
    throw new Error('Invalid gallery map payload');
  }

  const definitionSetup = await ensureMetafieldDefinitions(admin, { shop: options.shop });
  if (!definitionSetup.ready) {
    const errors = definitionSetup.definitions
      .filter((definition) => !definition.ready)
      .map((definition) => `${definition.key}: ${definition.message ?? 'not ready'}`)
      .join('; ');
    throw new Error(`Required Shopify metafields are not ready. ${errors}`);
  }

  const mutation = `#graphql
    mutation SetProductMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  galleryMap.updatedAt = new Date().toISOString();

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: productId,
          namespace: APP_CONFIG.metafields.namespace,
          key: APP_CONFIG.metafields.keyGalleryMap,
          type: 'json',
          value: JSON.stringify(galleryMap),
        },
        {
          ownerId: productId,
          namespace: APP_CONFIG.metafields.namespace,
          key: APP_CONFIG.metafields.keyEnabled,
          type: 'boolean',
          value: enabled ? 'true' : 'false',
        },
      ],
    },
  });

  const json = (await response.json()) as MetafieldsSetResponse;
  const errors = json.data?.metafieldsSet?.userErrors || [];
  if (errors.length > 0) {
    throw new Error(`Failed to save metafields: ${errors.map((error) => error.message).join(', ')}`);
  }

  return true;
}
