import { APP_CONFIG } from '~/config/app.config';
import { GalleryMapPayload, validateGalleryMap, createEmptyGalleryMap } from '~/models/gallery-map.schema';

export async function ensureMetafieldDefinitions(admin: any) {
  const query = `#graphql
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          name
          namespace
          key
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // 1. Definition for gallery_map
  try {
    await admin.graphql(query, {
      variables: {
        definition: {
          name: 'Prism Variant Media Gallery Map',
          namespace: APP_CONFIG.metafields.namespace,
          key: APP_CONFIG.metafields.keyGalleryMap,
          type: 'json',
          description: 'Stores variant to media item mapping for dynamic storefront gallery switching',
          ownerType: 'PRODUCT',
          access: {
            admin: 'MERCHANT_READ_WRITE',
            storefront: 'PUBLIC_READ',
          },
        },
      },
    });
  } catch (e) {
    console.error('Error creating gallery_map metafield definition:', e);
  }

  // 2. Definition for enabled
  try {
    await admin.graphql(query, {
      variables: {
        definition: {
          name: 'Prism Variant Media Enabled',
          namespace: APP_CONFIG.metafields.namespace,
          key: APP_CONFIG.metafields.keyEnabled,
          type: 'boolean',
          description: 'Enables custom variant media filtering for this product',
          ownerType: 'PRODUCT',
          access: {
            admin: 'MERCHANT_READ_WRITE',
            storefront: 'PUBLIC_READ',
          },
        },
      },
    });
  } catch (e) {
    console.error('Error creating enabled metafield definition:', e);
  }
}

export async function getProductGalleryMap(admin: any, productId: string) {
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
  const responseJson = await response.json();
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

let definitionsEnsured = false;

export async function saveProductGalleryMap(
  admin: any,
  productId: string,
  galleryMap: GalleryMapPayload,
  enabled: boolean
) {
  // Ensure metafield definitions exist with storefront public access
  if (!definitionsEnsured) {
    await ensureMetafieldDefinitions(admin);
    definitionsEnsured = true;
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

  const json = await response.json();
  const errors = json.data?.metafieldsSet?.userErrors || [];
  if (errors.length > 0) {
    throw new Error(`Failed to save metafields: ${errors.map((e: any) => e.message).join(', ')}`);
  }

  return true;
}
