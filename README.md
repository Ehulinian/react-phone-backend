# Phone Catalog Backend

Small Express + TypeScript API for the [react_phone-catalog](https://github.com/) frontend. Serves the product catalog and creates Stripe Checkout Sessions — the two things that genuinely need a server (the catalog could stay static, but bundling it here keeps the frontend fully decoupled from any specific data source).

## Endpoints

- `GET /health` — health check.
- `GET /api/products` — full flat product list (same shape as the old `products.json`).
- `GET /api/products/:category` — full specs for `phones` / `tablets` / `accessories`.
- `POST /api/checkout/session` — creates a Stripe Checkout Session. Body: `{ items: [{ id, name, price, quantity, image? }] }`. Returns `{ url }` — redirect the browser there.

## Local development

```bash
npm install
cp .env.example .env
# fill in STRIPE_SECRET_KEY with a test-mode key from
# https://dashboard.stripe.com/test/apikeys
npm run dev
```

The server starts on `http://localhost:4000` by default (`PORT` in `.env`).

## Deploying (Render.com)

1. Push this repo to GitHub.
2. On [render.com](https://render.com), New → Web Service → connect the repo.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables in the Render dashboard:
   - `STRIPE_SECRET_KEY` — your Stripe secret key (test or live).
   - `ALLOWED_ORIGINS` — comma-separated list, e.g. `https://your-username.github.io`
   - `FRONTEND_URL` — your deployed frontend URL, e.g. `https://your-username.github.io/react_phone-catalog`
6. Deploy. Render gives you a URL like `https://phone-catalog-backend.onrender.com`.

Note: on Render's free tier the service sleeps after 15 minutes of inactivity — the first request after a while takes a few extra seconds to wake it up. Fine for a portfolio demo.

## Wiring up the frontend

In the frontend repo, point the RTK Query `baseUrl` at this backend's deployed URL (via an env var, e.g. `REACT_APP_API_URL`), and have the Checkout button POST to `${REACT_APP_API_URL}/api/checkout/session`.

## Why a real backend instead of a Vercel serverless function

Stripe's secret key can never live in the browser bundle — whatever creates the Checkout Session has to run server-side. A single serverless function works too, but a small standalone Express API is arguably more representative of how this looks in a real job: a separate service with its own deploy, its own env vars, and room to grow (add a database, more endpoints, auth, etc.) without being tied to a specific hosting platform's function format.
