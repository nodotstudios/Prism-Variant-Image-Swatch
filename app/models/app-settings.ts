import type { GallerySettings } from './gallery-map.schema';

export type AppSettings = GallerySettings;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sharedMediaPosition: 'after',
  hideUnassignedMedia: true,
  fallbackMode: 'show_all',
};

export function validateAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== 'object') return false;
  const settings = value as Record<string, unknown>;

  return (
    (settings.sharedMediaPosition === 'after' || settings.sharedMediaPosition === 'before') &&
    typeof settings.hideUnassignedMedia === 'boolean' &&
    ['show_all', 'native_featured', 'shared_only', 'first_group'].includes(
      String(settings.fallbackMode),
    )
  );
}

export function parseAppSettings(value: unknown): AppSettings {
  return validateAppSettings(value) ? value : { ...DEFAULT_APP_SETTINGS };
}
