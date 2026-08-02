import { APP_CONFIG } from '~/config/app.config';
import {
  DEFAULT_APP_SETTINGS,
  parseAppSettings,
  type AppSettings,
} from '~/models/app-settings';
import type { AdminGraphQLClient, GraphQLUserError } from '~/types/shopify';

const SETTINGS_KEY = 'settings';

interface AppSettingsQueryResponse {
  data?: {
    currentAppInstallation?: {
      id: string;
      settings?: { value: string } | null;
    } | null;
  };
}

interface AppSettingsMutationResponse {
  data?: {
    metafieldsSet?: {
      userErrors?: GraphQLUserError[];
    } | null;
  };
}

export async function getAppSettings(admin: AdminGraphQLClient): Promise<AppSettings> {
  const response = await admin.graphql(`#graphql
    query GetPrismAppSettings {
      currentAppInstallation {
        id
        settings: metafield(
          namespace: "${APP_CONFIG.metafields.namespace}"
          key: "${SETTINGS_KEY}"
        ) {
          value
        }
      }
    }
  `);
  const json = (await response.json()) as AppSettingsQueryResponse;
  const rawValue = json.data?.currentAppInstallation?.settings?.value;
  if (!rawValue) return { ...DEFAULT_APP_SETTINGS };

  try {
    return parseAppSettings(JSON.parse(rawValue));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveAppSettings(
  admin: AdminGraphQLClient,
  settings: AppSettings,
): Promise<void> {
  const installationResponse = await admin.graphql(`#graphql
    query GetPrismAppInstallationId {
      currentAppInstallation {
        id
      }
    }
  `);
  const installationJson = (await installationResponse.json()) as AppSettingsQueryResponse;
  const ownerId = installationJson.data?.currentAppInstallation?.id;
  if (!ownerId) throw new Error('Unable to locate the current app installation');

  const response = await admin.graphql(
    `#graphql
      mutation SavePrismAppSettings($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: APP_CONFIG.metafields.namespace,
            key: SETTINGS_KEY,
            type: 'json',
            value: JSON.stringify(settings),
          },
        ],
      },
    },
  );
  const json = (await response.json()) as AppSettingsMutationResponse;
  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(`Failed to save app settings: ${errors.map((error) => error.message).join(', ')}`);
  }
}
