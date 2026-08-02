import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useFetcher, useNavigate } from 'react-router';
import { Page, Layout, Card, BlockStack, Text, Button, Checkbox, InlineGrid, Badge, Thumbnail, Banner, Divider, Box, InlineStack, Toast, Frame } from '@shopify/polaris';
import { useState, useEffect } from 'react';
import { authenticate } from '~/shopify.server';
import { getProductGalleryMap, saveProductGalleryMap } from '~/services/metafields.server';
import {
  createEmptyGalleryMap,
  generateGroupKey,
  normalizeVisualOptionNames,
  rebuildVariantToGroup,
  validateGalleryMap,
  type GalleryMapPayload,
} from '~/models/gallery-map.schema';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;
  const data = await getProductGalleryMap(admin, productId);

  if (!data) {
    throw new Response('Product not found', { status: 404 });
  }

  return { data };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;
  const formData = await request.formData();
  const payloadStr = formData.get('galleryMap') as string;
  const enabledStr = formData.get('enabled') as string;

  if (!payloadStr) {
    return { success: false, error: 'Missing gallery map payload' };
  }

  try {
    const galleryMap: unknown = JSON.parse(payloadStr);
    if (!validateGalleryMap(galleryMap) || galleryMap.productId !== productId) {
      return { success: false, error: 'Invalid gallery map payload' };
    }

    await saveProductGalleryMap(admin, productId, galleryMap, enabledStr === 'true', {
      shop: session.shop,
    });
    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to save the gallery map',
    };
  }
};

export default function SingleProductMapper() {
  const { data } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const isSaving = fetcher.state === 'submitting';

  const [toastActive, setToastActive] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (!fetcher.data) return;
    setIsClearing(false);
    if (fetcher.data.success) setToastActive(true);
  }, [fetcher.data]);

  const { product, galleryMap: initialMap, enabled: initialEnabled } = data;

  const [enabled, setEnabled] = useState(initialEnabled);
  const [selectedVisualOptions, setSelectedVisualOptions] = useState<string[]>(() =>
    normalizeVisualOptionNames(
      initialMap.visualOptionNames,
      product.options.map((option) => option.name),
    ),
  );

  const [galleryMap, setGalleryMap] = useState<GalleryMapPayload>(initialMap);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  const generateCombinations = () => {
    if (selectedVisualOptions.length === 0) return {};

    const combinations: Record<string, { label: string; variantIds: string[] }> = {};

    for (const variant of product.variants.nodes) {
      const selectedOptsMap: Record<string, string> = {};
      const labels: string[] = [];

      for (const opt of variant.selectedOptions) {
        if (selectedVisualOptions.includes(opt.name)) {
          selectedOptsMap[opt.name] = opt.value;
          labels.push(opt.value);
        }
      }

      const key = generateGroupKey(selectedOptsMap);
      const label = labels.join(' / ') || 'Default';

      if (!combinations[key]) {
        combinations[key] = { label, variantIds: [] };
      }
      combinations[key].variantIds.push(variant.id);
    }

    return combinations;
  };

  const combinations = generateCombinations();
  const combinationKeys = Object.keys(combinations);
  const currentActiveKey = activeGroupKey && combinations[activeGroupKey]
    ? activeGroupKey
    : combinationKeys[0] || null;

  const handleToggleOption = (optionName: string) => {
    setActiveGroupKey(null);
    if (selectedVisualOptions.includes(optionName)) {
      setSelectedVisualOptions(selectedVisualOptions.filter((o) => o !== optionName));
    } else {
      setSelectedVisualOptions([...selectedVisualOptions, optionName]);
    }
  };

  const handleToggleMediaInGroup = (mediaId: string, groupKey: string) => {
    const newGroups = { ...galleryMap.groups };
    if (!newGroups[groupKey]) {
      newGroups[groupKey] = {
        label: combinations[groupKey]?.label || groupKey,
        mediaIds: [],
      };
    }

    const currentMediaIds = [...newGroups[groupKey].mediaIds];
    const index = currentMediaIds.indexOf(mediaId);

    if (index > -1) {
      currentMediaIds.splice(index, 1);
    } else {
      currentMediaIds.push(mediaId);
    }

    newGroups[groupKey].mediaIds = currentMediaIds;

    const newVariantToGroup = { ...galleryMap.variantToGroup };
    for (const vId of combinations[groupKey]?.variantIds || []) {
      newVariantToGroup[vId] = groupKey;
    }

    setGalleryMap({
      ...galleryMap,
      visualOptionNames: selectedVisualOptions,
      groups: newGroups,
      variantToGroup: newVariantToGroup,
    });
  };

  const handleToggleSharedMedia = (mediaId: string) => {
    let currentShared = [...galleryMap.sharedMediaIds];
    if (currentShared.includes(mediaId)) {
      currentShared = currentShared.filter((id) => id !== mediaId);
    } else {
      currentShared.push(mediaId);
    }

    setGalleryMap({
      ...galleryMap,
      sharedMediaIds: currentShared,
    });
  };

  const handleSave = () => {
    const currentGroups = Object.fromEntries(
      combinationKeys
        .filter((groupKey) => Boolean(galleryMap.groups[groupKey]))
        .map((groupKey) => [groupKey, galleryMap.groups[groupKey]]),
    );
    const finalMap = {
      ...galleryMap,
      visualOptionNames: selectedVisualOptions,
      groups: currentGroups,
      variantToGroup: rebuildVariantToGroup(combinations, currentGroups),
    };

    const formData = new FormData();
    formData.set('galleryMap', JSON.stringify(finalMap));
    formData.set('enabled', enabled ? 'true' : 'false');

    fetcher.submit(formData, { method: 'post' });
  };

  const handleUnconfigure = () => {
    setIsClearing(true);
    const emptyMap = createEmptyGalleryMap(product.id);
    emptyMap.visualOptionNames = [];
    
    setGalleryMap(emptyMap);
    setSelectedVisualOptions([]);
    setEnabled(false);

    const formData = new FormData();
    formData.set('galleryMap', JSON.stringify(emptyMap));
    formData.set('enabled', 'false');

    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <Frame>
      <Page
        title={`Edit Media Map: ${product.title}`}
        backAction={{
          content: 'Products Catalog',
          onAction: () => navigate('/app/products'),
        }}
        primaryAction={{
          content: isSaving ? 'Saving...' : 'Save Mapping',
          onAction: handleSave,
          loading: isSaving,
        }}
        secondaryActions={[
          {
            content: 'Unconfigure (Clear All)',
            destructive: true,
            onAction: handleUnconfigure,
            loading: isClearing,
            disabled: isSaving
          },
        ]}
      >
        <BlockStack gap="500">
          {fetcher.data?.error && (
            <Banner title="Unable to save product mapping" tone="critical">
              <p>{fetcher.data.error}</p>
            </Banner>
          )}
          <Banner title="Product Configuration">
            <p>Select which options dictate media images & videos, then assign media items to each combination below.</p>
          </Banner>

          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Step 1 — Choose Visual Options</Text>
                  <Text as="h3" variant="headingSm">Select options that dictate media images & videos:</Text>
                  <InlineStack gap="400">
                    {product.options.map((opt) => (
                      <Checkbox
                        key={opt.id}
                        label={`${opt.name} (${opt.values.length} values)`}
                        checked={selectedVisualOptions.includes(opt.name)}
                        onChange={() => handleToggleOption(opt.name)}
                      />
                    ))}
                  </InlineStack>
                  <Checkbox
                    label="Enable storefront variant media filtering for this product"
                    checked={enabled}
                    onChange={setEnabled}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Step 2 & 3 — Media Assignment Grid</Text>
                  <Text as="h3" variant="headingSm">Visual Combinations ({combinationKeys.length.toString()}):</Text>
                  
                  <InlineStack gap="200">
                    {combinationKeys.map((key) => {
                      const isSelected = key === currentActiveKey;
                      const assignedCount = galleryMap.groups[key]?.mediaIds?.length || 0;
                      return (
                        <Button
                          key={key}
                          tone={isSelected ? 'critical' : undefined}
                          variant={isSelected ? 'primary' : 'secondary'}
                          onClick={() => setActiveGroupKey(key)}
                        >
                          {`${combinations[key].label} (${assignedCount.toString()} media)`}
                        </Button>
                      );
                    })}
                  </InlineStack>

                  <Divider />

                  {currentActiveKey && (
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        Assign Media for: <b>{combinations[currentActiveKey]?.label}</b>
                      </Text>

                      <InlineGrid columns={{ xs: 2, sm: 4, md: 6 }} gap="300">
                        {product.media.nodes.map((mediaItem) => {
                          const mediaId = mediaItem.id;
                          const isAssigned = (galleryMap.groups[currentActiveKey]?.mediaIds || []).includes(mediaId);
                          const isShared = galleryMap.sharedMediaIds.includes(mediaId);
                          const imgUrl = mediaItem.image?.url || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';

                          return (
                            <Box
                              key={mediaId}
                              padding="200"
                              borderWidth="025"
                              borderColor={isAssigned ? 'border-brand' : 'border-secondary'}
                              borderRadius="200"
                            >
                              <BlockStack gap="200" align="center">
                                <Thumbnail source={imgUrl} alt={mediaItem.alt || 'Media item'} size="medium" />
                                <Badge tone={mediaItem.mediaContentType === 'IMAGE' ? 'info' : 'attention'}>
                                  {mediaItem.mediaContentType}
                                </Badge>
                                <Checkbox
                                  label="Assign to Group"
                                  checked={isAssigned}
                                  onChange={() => handleToggleMediaInGroup(mediaId, currentActiveKey)}
                                />
                                <Checkbox
                                  label="Shared (All)"
                                  checked={isShared}
                                  onChange={() => handleToggleSharedMedia(mediaId)}
                                />
                              </BlockStack>
                            </Box>
                          );
                        })}
                      </InlineGrid>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>
        {toastActive && (
          <Toast content="Mapping saved successfully!" onDismiss={() => setToastActive(false)} duration={4000} />
        )}
      </Page>
    </Frame>
  );
}
