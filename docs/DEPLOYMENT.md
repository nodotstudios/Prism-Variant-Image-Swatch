# Deployment Guide — Prism Variant Media

## Custom Distribution Deployment Steps

1. **Verify Environment Variables**: Ensure `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `DATABASE_URL` are configured on your hosting provider (e.g. Fly.io, Heroku, or AWS).
2. **Deploy App Extensions**:
   ```bash
   shopify app deploy
   ```
3. **Run Prisma Migrations**:
   ```bash
   npx prisma migrate deploy
   ```
4. **App Embed Activation**:
   In the merchant's Shopify Admin -> Online Store -> Themes -> Customize -> App Embeds -> Enable **Prism Variant Media Embed**.
