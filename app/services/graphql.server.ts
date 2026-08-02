import { APP_CONFIG } from '~/config/app.config';
import type { AdminGraphQLClient } from '~/types/shopify';

export interface ProductFilterOptions {
  query?: string;
  status?: string;
  configuredFilter?: 'all' | 'configured' | 'unconfigured';
  first?: number;
  after?: string;
}

interface CatalogProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  featuredImage?: { url: string; altText?: string | null } | null;
  variantsCount?: { count: number };
  media?: { nodes?: Array<{ id: string }> };
  galleryMapMetafield?: { id: string; value: string } | null;
  enabledMetafield?: { id: string; value: string } | null;
}

interface CatalogResponse {
  data?: {
    products?: {
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string | null;
        endCursor?: string | null;
      };
      nodes: CatalogProductNode[];
    };
  };
}

interface DashboardResponse {
  data?: {
    products?: {
      nodes: Array<{
        id: string;
        galleryMapMetafield?: { value: string } | null;
      }>;
    };
  };
}

export async function getProductsCatalog(admin: AdminGraphQLClient, options: ProductFilterOptions = {}) {
  const { query = '', first = 25, after = null } = options;

  const gqlQuery = `#graphql
    query GetProductsCatalog($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: TITLE) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        nodes {
          id
          title
          handle
          status
          vendor
          productType
          tags
          featuredImage {
            url
            altText
          }
          variantsCount {
            count
          }
          media(first: 250) {
            nodes {
              id
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
    }
  `;

  const response = await admin.graphql(gqlQuery, {
    variables: {
      first,
      after,
      query: query || null,
    },
  });

  const json = (await response.json()) as CatalogResponse;
  const productsData = json.data?.products;

  if (!productsData) {
    return {
      products: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    };
  }

  const products = productsData.nodes.map((node) => {
    let isConfigured = false;
    let enabled = true;

    if (node.galleryMapMetafield?.value) {
      try {
        const parsed = JSON.parse(node.galleryMapMetafield.value);
        const groups = parsed && typeof parsed === 'object' && 'groups' in parsed
          ? (parsed.groups as Record<string, { mediaIds?: string[] }>)
          : {};
        const sharedMediaIds = parsed && typeof parsed === 'object' && 'sharedMediaIds' in parsed
          ? parsed.sharedMediaIds
          : [];
        const hasGroupMedia = Object.values(groups).some((group) => (group.mediaIds?.length ?? 0) > 0);
        const hasSharedMedia = Array.isArray(sharedMediaIds) && sharedMediaIds.length > 0;
        isConfigured = hasGroupMedia || hasSharedMedia;
      } catch {
        isConfigured = false;
      }
    }

    if (node.enabledMetafield?.value !== undefined) {
      enabled = node.enabledMetafield.value === 'true';
    }

    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      status: node.status,
      vendor: node.vendor,
      productType: node.productType,
      tags: node.tags,
      featuredImageUrl: node.featuredImage?.url,
      variantCount: node.variantsCount?.count || 0,
      mediaCount: node.media?.nodes?.length || 0,
      isConfigured,
      enabled,
    };
  });

  return {
    products,
    pageInfo: productsData.pageInfo,
  };
}

export async function getDashboardStats(admin: AdminGraphQLClient) {
  const gqlQuery = `#graphql
    query GetDashboardStats {
      products(first: 250) {
        nodes {
          id
          galleryMapMetafield: metafield(
            namespace: "${APP_CONFIG.metafields.namespace}",
            key: "${APP_CONFIG.metafields.keyGalleryMap}"
          ) {
            value
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(gqlQuery);
    const json = (await response.json()) as DashboardResponse;
    const nodes = json.data?.products?.nodes || [];

    const totalProducts = nodes.length;
    let configuredProducts = 0;
    let unconfiguredProducts = 0;

    for (const node of nodes) {
      if (node.galleryMapMetafield?.value) {
        try {
          const parsed = JSON.parse(node.galleryMapMetafield.value);
          if (Object.keys(parsed.groups || {}).length > 0) {
            configuredProducts++;
          } else {
            unconfiguredProducts++;
          }
        } catch {
          unconfiguredProducts++;
        }
      } else {
        unconfiguredProducts++;
      }
    }

    return {
      totalProducts,
      configuredProducts,
      unconfiguredProducts,
    };
  } catch (e) {
    console.error('Error fetching dashboard stats:', e);
    return {
      totalProducts: 0,
      configuredProducts: 0,
      unconfiguredProducts: 0,
    };
  }
}
