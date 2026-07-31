import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

export const PLAN_PRO = 'Pro Plan ($9.99/mo)';
export const PLAN_ENTERPRISE = 'Enterprise Plan ($29.99/mo)';

// Fallback in-memory storage for Vercel serverless environments
class MemorySessionStorage {
  private sessions = new Map<string, any>();

  async storeSession(session: any): Promise<boolean> {
    this.sessions.set(session.id, session);
    return true;
  }

  async loadSession(id: string): Promise<any> {
    return this.sessions.get(id);
  }

  async deleteSession(id: string): Promise<boolean> {
    this.sessions.delete(id);
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    ids.forEach((id) => this.sessions.delete(id));
    return true;
  }

  async findSessionsByShop(shop: string): Promise<any[]> {
    return Array.from(this.sessions.values()).filter((s) => s.shop === shop);
  }
}

const storage = process.env.VERCEL
  ? new MemorySessionStorage()
  : new PrismaSessionStorage(prisma);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: storage as any,
  distribution: AppDistribution.AppStore,
  billing: {
    [PLAN_PRO]: {
      lineItems: [
        {
          amount: 9.99,
          currencyCode: 'USD',
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [PLAN_ENTERPRISE]: {
      lineItems: [
        {
          amount: 29.99,
          currencyCode: 'USD',
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
