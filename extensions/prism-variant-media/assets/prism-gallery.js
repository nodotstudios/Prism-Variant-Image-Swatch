(function () {
  'use strict';

  function initPrismGallery() {
    const dataScript = document.getElementById('prism-variant-media-data');
    if (!dataScript) return;

    let config;
    try {
      const rawText = dataScript.textContent || '{}';
      config = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    } catch (e) {
      return;
    }

    let galleryMap;
    try {
      if (typeof config.galleryMapRaw === 'string') {
        galleryMap = JSON.parse(config.galleryMapRaw);
      } else if (typeof config.galleryMapRaw === 'object' && config.galleryMapRaw !== null) {
        galleryMap = config.galleryMapRaw;
      } else if (config.galleryMap) {
        galleryMap = typeof config.galleryMap === 'string' ? JSON.parse(config.galleryMap) : config.galleryMap;
      }
    } catch (e) {
      return;
    }

    if (!galleryMap || !galleryMap.variantToGroup || !galleryMap.groups) return;

    const debug = true;
    function log(...args) {
      if (debug) console.log('[PrismVariantMedia]', ...args);
    }

    function slideMatchesMediaId(el, activeNumericIds) {
      if (!activeNumericIds || activeNumericIds.length === 0) return true;

      const attributesToSearch = [
        el.getAttribute('data-media-id') || '',
        el.getAttribute('data-target') || '',
        el.getAttribute('data-media-item-id') || '',
        el.getAttribute('data-thumbnail-id') || '',
        el.id || ''
      ];

      const children = el.querySelectorAll('[data-media-id], [data-target], [id], img');
      children.forEach((child) => {
        attributesToSearch.push(child.getAttribute('data-media-id') || '');
        attributesToSearch.push(child.getAttribute('data-target') || '');
        attributesToSearch.push(child.id || '');
        if (child.src) attributesToSearch.push(child.src);
      });

      const combinedSearchStr = attributesToSearch.join(' ');

      return activeNumericIds.some((numId) => combinedSearchStr.includes(numId));
    }

    function getTopLevelMediaSlides() {
      const slides = document.querySelectorAll(
        'media-gallery .product__media-item, ' +
        '.product__media-list > li, ' +
        '.product-media-container, ' +
        '.product-single__media-wrapper, ' +
        '.slider__slide'
      );

      const items = [];
      slides.forEach((el) => {
        items.push(el);
      });
      return items;
    }

    function getTopLevelThumbnails() {
      const thumbs = document.querySelectorAll(
        '.thumbnail-list__item, ' +
        '.thumbnail-list > li, ' +
        '.product__thumb-item'
      );

      const items = [];
      thumbs.forEach((el) => {
        items.push(el);
      });
      return items;
    }

    function showAllElements(items) {
      items.forEach((el) => {
        el.style.display = '';
        el.classList.remove('is-hidden');
        el.setAttribute('aria-hidden', 'false');
      });
    }

    function applyFiltering(activeMediaGids) {
      log('Filtering gallery for active GIDs:', activeMediaGids);
      const mediaItems = getTopLevelMediaSlides();
      const thumbItems = getTopLevelThumbnails();

      if (!activeMediaGids || activeMediaGids.length === 0) {
        showAllElements(mediaItems);
        showAllElements(thumbItems);
        return;
      }

      const activeNumericIds = activeMediaGids.map((gid) => {
        const parts = String(gid).split('/');
        return parts[parts.length - 1];
      });

      let matchingCount = 0;
      mediaItems.forEach((el) => {
        if (slideMatchesMediaId(el, activeNumericIds)) {
          matchingCount++;
        }
      });

      if (matchingCount === 0) {
        showAllElements(mediaItems);
        showAllElements(thumbItems);
        return;
      }

      mediaItems.forEach((el) => {
        if (slideMatchesMediaId(el, activeNumericIds)) {
          el.style.display = '';
          el.classList.remove('is-hidden');
          el.setAttribute('aria-hidden', 'false');
        } else {
          el.style.display = 'none';
          el.classList.add('is-hidden');
          el.setAttribute('aria-hidden', 'true');
        }
      });

      thumbItems.forEach((el) => {
        if (slideMatchesMediaId(el, activeNumericIds)) {
          el.style.display = '';
          el.classList.remove('is-hidden');
          el.setAttribute('aria-hidden', 'false');
        } else {
          el.style.display = 'none';
          el.classList.add('is-hidden');
          el.setAttribute('aria-hidden', 'true');
        }
      });
    }

    function updateGalleryForVariant(variantId) {
      if (!variantId) return;
      const variantGid = String(variantId).includes('gid://')
        ? String(variantId)
        : `gid://shopify/ProductVariant/${variantId}`;

      log('Updating gallery for variant GID:', variantGid);

      const groupKey = galleryMap.variantToGroup[variantGid];
      if (!groupKey) {
        applyFiltering([]);
        return;
      }

      const group = galleryMap.groups[groupKey];
      if (!group) {
        applyFiltering([]);
        return;
      }

      let groupMedia = group.mediaIds || [];
      const sharedMedia = galleryMap.sharedMediaIds || [];
      const position = galleryMap.settings?.sharedMediaPosition || 'after';

      let combinedMediaGids;
      if (position === 'before') {
        combinedMediaGids = [...sharedMedia, ...groupMedia];
      } else {
        combinedMediaGids = [...groupMedia, ...sharedMedia];
      }

      combinedMediaGids = Array.from(new Set(combinedMediaGids));

      if (combinedMediaGids.length === 0) {
        applyFiltering([]);
        return;
      }

      applyFiltering(combinedMediaGids);
    }

    function getSelectedVariantId() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('variant')) {
        return urlParams.get('variant');
      }

      const variantInput = document.querySelector('form[action*="/cart/add"] [name="id"], select[name="id"], [name="id"]');
      if (variantInput && variantInput.value) {
        return variantInput.value;
      }

      return config.selectedVariantId;
    }

    // Run initial filtering immediately
    const initialVariantId = getSelectedVariantId();
    if (initialVariantId) {
      updateGalleryForVariant(initialVariantId);
    }

    document.addEventListener('change', (e) => {
      const target = e.target;
      if (
        target.matches('[name="id"]') ||
        target.matches('variant-selects select') ||
        target.matches('variant-radios input') ||
        target.closest('form[action*="/cart/add"]') ||
        target.closest('variant-selects') ||
        target.closest('variant-radios')
      ) {
        setTimeout(() => {
          const currentId = getSelectedVariantId();
          updateGalleryForVariant(currentId);
        }, 30);
      }
    });

    document.addEventListener('variant-change', (e) => {
      const variant = e.detail?.variant;
      if (variant && variant.id) {
        updateGalleryForVariant(variant.id);
      }
    });

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        const currentId = getSelectedVariantId();
        if (currentId) updateGalleryForVariant(currentId);
      }
    }, 100);
  }

  // Execute immediately or on DOM ready
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initPrismGallery();
  } else {
    document.addEventListener('DOMContentLoaded', initPrismGallery);
  }
})();
