(function () {
  'use strict';

  const MEDIA_ID_ATTRIBUTES = [
    'data-media-id',
    'data-target',
    'data-media-item-id',
    'data-thumbnail-id',
    'slide-id',
    'id',
  ];

  function numericId(value) {
    const matches = String(value || '').match(/\d{6,}/g);
    return matches?.at(-1) || null;
  }

  function gidNumericId(gid) {
    return numericId(String(gid).split('/').at(-1));
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function variantIdFromControl(element) {
    const selectedOption = element.matches('select')
      ? element.selectedOptions?.[0]
      : null;
    const candidate = selectedOption?.getAttribute('data-variant-id')
      || element.getAttribute('data-variant-id');
    return candidate ? String(candidate) : null;
  }

  function variantIdFromEvent(event) {
    const detail = event.detail || {};
    const candidate = detail.variantId
      || detail.variant?.id
      || detail.selectedVariant?.id;
    return candidate ? String(candidate) : null;
  }

  class GalleryAdapter {
    constructor(mediaSelector, thumbnailSelector) {
      this.mediaSelector = mediaSelector;
      this.thumbnailSelector = thumbnailSelector;
    }

    getMediaElements() {
      return Array.from(document.querySelectorAll(this.mediaSelector));
    }

    getThumbnailElements() {
      return Array.from(document.querySelectorAll(this.thumbnailSelector));
    }

    getElementMediaId(element) {
      const candidates = [element, ...element.querySelectorAll('[data-media-id], [data-target], [data-media-item-id], [data-thumbnail-id], [slide-id], [id]')];
      for (const candidate of candidates) {
        for (const attribute of MEDIA_ID_ATTRIBUTES) {
          const id = numericId(candidate.getAttribute(attribute));
          if (id) return id;
        }
      }
      return null;
    }

    setVisible(element, visible) {
      element.style.display = visible ? '' : 'none';
      element.classList.toggle('is-hidden', !visible);
      element.setAttribute('aria-hidden', visible ? 'false' : 'true');

      if (!visible) {
        element.querySelectorAll('video, audio').forEach((media) => {
          if (typeof media.pause === 'function') media.pause();
        });
        element.querySelectorAll('model-viewer').forEach((modelViewer) => {
          if (typeof modelViewer.pause === 'function') modelViewer.pause();
        });
        element.querySelectorAll('iframe').forEach((iframe) => {
          iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        });
      }
    }

    showAll() {
      [...this.getMediaElements(), ...this.getThumbnailElements()].forEach((element) => {
        element.style.order = '';
        this.setVisible(element, true);
      });
    }

    applyMediaOrder(elements, activeNumericIds) {
      const order = new Map(activeNumericIds.map((id, index) => [id, index]));
      elements.forEach((element) => {
        const mediaId = this.getElementMediaId(element);
        element.style.order = mediaId && order.has(mediaId)
          ? String(order.get(mediaId))
          : String(activeNumericIds.length + 1);
      });
    }

    showMedia(activeMediaGids, allAssignedMediaGids, hideUnassignedMedia) {
      if (!activeMediaGids || activeMediaGids.length === 0) {
        this.showAll();
        return;
      }

      const mediaElements = this.getMediaElements();
      const thumbnailElements = this.getThumbnailElements();
      const activeNumericIds = unique(activeMediaGids.map(gidNumericId));
      const assignedNumericIds = new Set(unique(allAssignedMediaGids.map(gidNumericId)));
      const shouldShow = (element) => {
        const mediaId = this.getElementMediaId(element);
        if (!mediaId) return false;
        return activeNumericIds.includes(mediaId) || (!hideUnassignedMedia && !assignedNumericIds.has(mediaId));
      };

      const matchingSlides = mediaElements.filter(shouldShow);
      if (matchingSlides.length === 0) {
        this.showAll();
        return;
      }

      this.applyMediaOrder(mediaElements, activeNumericIds);
      this.applyMediaOrder(thumbnailElements, activeNumericIds);
      mediaElements.forEach((element) => this.setVisible(element, shouldShow(element)));
      thumbnailElements.forEach((element) => this.setVisible(element, shouldShow(element)));
      this.activateFirstVisibleThumbnail(thumbnailElements, activeNumericIds[0]);
    }

    activateFirstVisibleThumbnail(thumbnails, preferredMediaId) {
      const visibleThumbnails = thumbnails.filter((element) => element.style.display !== 'none');
      const firstThumbnail = visibleThumbnails.find(
        (element) => this.getElementMediaId(element) === preferredMediaId,
      ) || visibleThumbnails[0];
      if (!firstThumbnail) return;

      if (firstThumbnail.matches('[aria-current="true"], .is-active, [aria-selected="true"]')) {
        return;
      }

      const control = firstThumbnail?.querySelector('button, a') || firstThumbnail;
      if (control && typeof control.click === 'function') control.click();
    }

    getSelectedVariantId(defaultVariantId) {
      const input = document.querySelector(
        'form[action*="/cart/add"] [name="id"], select[name="id"], input[name="id"]',
      );
      if (input?.value) return input.value;

      const variantFromUrl = new URLSearchParams(window.location.search).get('variant');
      return variantFromUrl || defaultVariantId;
    }

    getVariantControlSelector() {
      return '[name="id"], variant-selects select, variant-radios input';
    }

    getVariantRootSelector() {
      return 'form[action*="/cart/add"], variant-selects, variant-radios';
    }

    observeVariantChanges(callback) {
      const variantControlSelector = this.getVariantControlSelector();
      const variantRootSelector = this.getVariantRootSelector();
      let scheduled = false;
      let pendingVariantId = null;
      const schedule = (variantId) => {
        pendingVariantId = variantId || pendingVariantId;
        if (scheduled) return;
        scheduled = true;
        const run = () => {
          scheduled = false;
          const nextVariantId = pendingVariantId;
          pendingVariantId = null;
          callback(nextVariantId || undefined);
        };
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(run);
        } else {
          window.setTimeout(run, 0);
        }
      };

      document.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (
          target.matches(variantControlSelector)
          || target.closest(variantRootSelector)
        ) {
          schedule(variantIdFromControl(target));
        }
      });

      ['variant-change', 'variant:change', 'product:variant-change', 'product:select'].forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
          schedule(variantIdFromEvent(event));
        });
      });

      if (typeof MutationObserver === 'function' && document.body) {
        const observer = new MutationObserver((mutations) => {
          const hasVariantMutation = mutations.some((mutation) => {
            const target = mutation.target instanceof Element
              ? mutation.target
              : mutation.target.parentElement;
            if (target?.closest(variantRootSelector)) return true;
            return Array.from(mutation.addedNodes || []).some((node) => (
              node instanceof Element
              && (node.matches(variantRootSelector)
                || Boolean(node.querySelector(variantRootSelector)))
            ));
          });
          if (hasVariantMutation) schedule();
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['value', 'checked', 'selected', 'data-variant-id'],
        });
      }

      document.addEventListener('shopify:section:load', () => schedule());
      window.addEventListener('popstate', () => schedule());
      window.addEventListener('pageshow', () => schedule());
      
      // Modern Shopify themes use history.replaceState which doesn't trigger popstate
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          schedule();
        }
      }, 100);
    }
  }

  class HorizonAdapter extends GalleryAdapter {
    static detect() {
      return Boolean(document.querySelector(
        'product-information, product-gallery, media-gallery slideshow-slide.product-media-container',
      ));
    }

    constructor() {
      super(
        'media-gallery slideshow-slide.product-media-container, '
          + 'media-gallery li.product-media-container, '
          + 'product-gallery [data-media-id], '
          + 'product-gallery .product-media-container',
        'media-gallery .slideshow-controls__thumbnail, '
          + 'product-gallery [data-thumbnail-id]',
      );
    }

    getSelectedVariantId(defaultVariantId) {
      const selectedHorizonControl = document.querySelector(
        'variant-picker input:checked[data-variant-id], '
        + 'variant-picker option:checked[data-variant-id], '
        + 'variant-picker [aria-selected="true"][data-variant-id]',
      );
      const horizonVariantId = selectedHorizonControl
        ? variantIdFromControl(selectedHorizonControl)
        : null;
      return horizonVariantId || super.getSelectedVariantId(defaultVariantId);
    }

    getVariantControlSelector() {
      return '[name="id"], variant-picker input, variant-picker select';
    }

    getVariantRootSelector() {
      return 'form[action*="/cart/add"], variant-picker';
    }

    getMediaElements() {
      return super.getMediaElements().filter(
        (element) => !element.closest('dialog, zoom-dialog, .dialog-zoomed-gallery'),
      );
    }

    getThumbnailElements() {
      return super.getThumbnailElements().filter(
        (element) => !element.closest('dialog, zoom-dialog, .dialog-zoomed-gallery'),
      );
    }

    setVisible(element, visible) {
      super.setVisible(element, visible);
      if (visible) {
        element.style.removeProperty('display');
      } else {
        element.style.setProperty('display', 'none', 'important');
      }
      element.toggleAttribute('hidden', !visible);
    }

    getElementMediaId(element) {
      if (element.matches('.slideshow-controls__thumbnail')) {
        const gallery = element.closest('media-gallery, product-gallery');
        const mediaElements = gallery
          ? this.getMediaElements().filter((media) => gallery.contains(media))
          : this.getMediaElements();
        const thumbnails = gallery
          ? this.getThumbnailElements().filter((thumbnail) => gallery.contains(thumbnail))
          : this.getThumbnailElements();
        const thumbnailIndex = thumbnails.indexOf(element);
        if (thumbnailIndex >= 0 && mediaElements.length > 0) {
          const matchingMedia = mediaElements[thumbnailIndex % mediaElements.length];
          const mediaId = super.getElementMediaId(matchingMedia);
          if (mediaId) return mediaId;
        }
      }

      return super.getElementMediaId(element);
    }

    activateFirstVisibleThumbnail(thumbnails, preferredMediaId) {
      const preferredSlide = this.getMediaElements().find(
        (element) => this.getElementMediaId(element) === preferredMediaId,
      );
      const slideshow = preferredSlide?.closest('slideshow-component');
      const slideId = preferredSlide?.getAttribute('slide-id');
      if (slideshow && slideId && typeof slideshow.select === 'function') {
        Promise.resolve(
          slideshow.select({ id: slideId }, undefined, { animate: false }),
        ).catch(() => {});
        return;
      }

      super.activateFirstVisibleThumbnail(thumbnails, preferredMediaId);
    }
  }

  class DawnAdapter extends GalleryAdapter {
    static detect() {
      return Boolean(document.querySelector('media-gallery'));
    }

    constructor() {
      super(
        'media-gallery .product__media-item, .product__media-list > li',
        '.thumbnail-list__item, .thumbnail-list > li',
      );
    }
  }

  class GenericAdapter extends GalleryAdapter {
    constructor() {
      super(
        '.product-media-container, .product-single__media-wrapper, .product__media-list > li, .slider__slide[data-media-id]',
        '.product__thumb-item, [data-thumbnail-id]',
      );
    }
  }

  function selectAdapter() {
    if (DawnAdapter.detect()) return new DawnAdapter();
    if (HorizonAdapter.detect()) return new HorizonAdapter();
    return new GenericAdapter();
  }

  function combineGroupAndShared(groupMedia, sharedMedia, position) {
    return unique(position === 'before'
      ? [...sharedMedia, ...groupMedia]
      : [...groupMedia, ...sharedMedia]);
  }

  function initPrismGallery() {
    const dataScript = document.getElementById('prism-variant-media-data');
    if (!dataScript) return;

    let config;
    let galleryMap;
    let globalSettings = {};
    try {
      config = JSON.parse(dataScript.textContent || '{}');
      galleryMap = typeof config.galleryMapRaw === 'string'
        ? JSON.parse(config.galleryMapRaw)
        : config.galleryMapRaw;
      globalSettings = typeof config.globalSettings === 'string'
        ? JSON.parse(config.globalSettings)
        : (config.globalSettings || {});
    } catch {
      return;
    }

    if (!galleryMap?.variantToGroup || !galleryMap?.groups) return;

    const adapter = selectAdapter();
    const settings = {
      sharedMediaPosition: 'after',
      hideUnassignedMedia: true,
      fallbackMode: 'show_all',
      ...(galleryMap.settings || {}),
      ...globalSettings,
    };
    const sharedMedia = galleryMap.sharedMediaIds || [];
    const allAssignedMedia = unique([
      ...sharedMedia,
      ...Object.values(galleryMap.groups).flatMap((group) => group.mediaIds || []),
    ]);

    const log = (...args) => {
      if (config.debug) console.info('[PrismVariantMedia]', ...args);
    };

    function fallbackMedia(variantGid) {
      switch (settings.fallbackMode) {
        case 'native_featured': {
          const numericVariantId = gidNumericId(variantGid);
          const featuredMedia = config.variantFeaturedMedia?.[variantGid]
            || config.variantFeaturedMedia?.[numericVariantId];
          return featuredMedia ? [featuredMedia] : null;
        }
        case 'shared_only':
          return sharedMedia.length > 0 ? sharedMedia : null;
        case 'first_group': {
          const firstGroup = Object.values(galleryMap.groups)[0];
          const media = combineGroupAndShared(
            firstGroup?.mediaIds || [],
            sharedMedia,
            settings.sharedMediaPosition,
          );
          return media.length > 0 ? media : null;
        }
        case 'show_all':
        default:
          return null;
      }
    }

    function updateGallery(variantId) {
      const selectedVariantId = variantId || adapter.getSelectedVariantId(config.selectedVariantId);
      if (!selectedVariantId) return;

      const variantGid = String(selectedVariantId).includes('gid://')
        ? String(selectedVariantId)
        : `gid://shopify/ProductVariant/${selectedVariantId}`;
      const group = galleryMap.groups[galleryMap.variantToGroup[variantGid]];
      const activeMedia = group
        ? combineGroupAndShared(group.mediaIds || [], sharedMedia, settings.sharedMediaPosition)
        : fallbackMedia(variantGid);

      log('Applying variant media', { variantGid, activeMedia, settings });
      adapter.showMedia(activeMedia, allAssignedMedia, settings.hideUnassignedMedia);
    }

    updateGallery();
    adapter.observeVariantChanges(updateGallery);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrismGallery, { once: true });
  } else {
    initPrismGallery();
  }
})();
