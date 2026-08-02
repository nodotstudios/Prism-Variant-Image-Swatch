import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useSubmit, useNavigate } from 'react-router';
import { Page, Card, IndexTable, Text, Badge, TextField, Thumbnail, Button } from '@shopify/polaris';
import { useState, useCallback } from 'react';
import { authenticate } from '../shopify.server';
import { getProductsCatalog } from '~/services/graphql.server';

export interface CatalogProductItem {
  id: string;
  title: string;
  handle: string;
  featuredImageUrl?: string;
  variantCount: number;
  mediaCount: number;
  isConfigured: boolean;
  enabled: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const after = url.searchParams.get('after') || undefined;

  const catalog = await getProductsCatalog(admin, { query, first: 20, after });
  return { catalog, query };
};

export default function ProductsPage() {
  const { catalog, query: initialQuery } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigate = useNavigate();

  const [queryValue, setQueryValue] = useState(initialQuery);

  const handleFiltersQueryChange = useCallback(
    (value: string) => {
      setQueryValue(value);
      const formData = new FormData();
      if (value) formData.set('query', value);
      submit(formData, { method: 'get' });
    },
    [submit]
  );

  const rowMarkup = catalog.products.map(
    (
      { id, title, featuredImageUrl, variantCount, mediaCount, isConfigured }: CatalogProductItem,
      index: number
    ) => {
      const rawId = id.split('/').pop();

      return (
        <IndexTable.Row id={id} key={id} position={index}>
          <IndexTable.Cell>
            <Thumbnail
              source={featuredImageUrl || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png'}
              alt={title}
              size="small"
            />
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {title}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{variantCount.toString()} variants</IndexTable.Cell>
          <IndexTable.Cell>{mediaCount.toString()} media</IndexTable.Cell>
          <IndexTable.Cell>
            {isConfigured ? (
              <Badge tone="success">Configured</Badge>
            ) : (
              <Badge tone="info">Unconfigured</Badge>
            )}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Button
              variant="primary"
              onClick={() => navigate(`/app/products/${rawId}`)}
            >
              Edit Media Map
            </Button>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <Page title="Products Catalog" subtitle="Manage variant to media mappings for your products">
      <Card padding="0">
        <div style={{ padding: '16px' }}>
          <TextField
            label="Search products"
            value={queryValue}
            onChange={handleFiltersQueryChange}
            placeholder="Search by product title or handle"
            clearButton
            onClearButtonClick={() => handleFiltersQueryChange('')}
            autoComplete="off"
          />
        </div>
        <IndexTable
          resourceName={{ singular: 'product', plural: 'products' }}
          itemCount={catalog.products.length}
          selectable={false}
          headings={[
            { title: '' },
            { title: 'Product' },
            { title: 'Variants' },
            { title: 'Media' },
            { title: 'Status' },
            { title: 'Action' },
          ]}
        >
          {rowMarkup}
        </IndexTable>
        {catalog.pageInfo.hasNextPage && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
            <Button
              onClick={() => {
                const formData = new FormData();
                if (queryValue) formData.set('query', queryValue);
                if (catalog.pageInfo.endCursor) formData.set('after', catalog.pageInfo.endCursor);
                submit(formData, { method: 'get' });
              }}
            >
              Next Page
            </Button>
          </div>
        )}
      </Card>
    </Page>
  );
}
