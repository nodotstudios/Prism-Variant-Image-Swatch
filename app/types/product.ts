export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  selectedOptions: SelectedOption[];
  image?: {
    id: string;
    url: string;
  } | null;
}

export interface ProductMedia {
  id: string;
  mediaContentType: string;
  alt?: string | null;
  image?: { url: string } | null;
  sources?: Array<{ url: string }>;
  embedUrl?: string;
}

export interface ProductDetails {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    url: string;
    altText?: string | null;
  } | null;
  options: ProductOption[];
  variants: { nodes: ProductVariant[] };
  media: { nodes: ProductMedia[] };
  galleryMapMetafield?: { id: string; value: string } | null;
  enabledMetafield?: { id: string; value: string } | null;
}

export interface CSVExportProduct {
  id: string;
  handle: string;
  variants?: {
    nodes: Array<Pick<ProductVariant, 'id' | 'title'>>;
  };
}
