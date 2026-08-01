import type { LoaderFunctionArgs } from 'react-router';
import { authenticate, PLAN_PRO, PLAN_ENTERPRISE } from '../shopify.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const plan = url.searchParams.get('plan');

  const apiKey = process.env.SHOPIFY_API_KEY || "b524766caf5859eb3910305d16617068";
  const returnUrl = `https://${session.shop}/admin/apps/${apiKey}/app/settings`;

  if (plan === 'PRO') {
    return await billing.request({
      plan: PLAN_PRO,
      isTest: true,
      returnUrl,
    });
  }

  if (plan === 'ENTERPRISE') {
    return await billing.request({
      plan: PLAN_ENTERPRISE,
      isTest: true,
      returnUrl,
    });
  }

  return new Response("Invalid plan specified", { status: 400 });
};
