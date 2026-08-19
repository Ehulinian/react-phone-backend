# Phone Catalog Backend

Small Express + TypeScript API for the [react_phone-catalog](https://github.com/) frontend. Serves the product catalog and creates Stripe Checkout Sessions — the two things that genuinely need a server (the catalog could stay static, but bundling it here keeps the frontend fully decoupled from any specific data source).

## Endpoints

- `GET /health` — health check.
- `GET /api/products` — full flat product list (same shape as the old `products.json`).
- `GET /api/products/:category` — full specs for `phones` / `tablets` / `accessories`.
- `POST /api/checkout/session` — creates a Stripe Checkout Session. Body: `{ items: [{ id, name, price, quantity, image? }] }`. Returns `{ url }` — redirect the browser there.
- `POST /api/assistant` — shopping assistant. Body: `{ messages: [{ role, content }] }`. Uses OpenAI tool calling: the model decides when to invoke a `search_products` function against the catalogue, and the reply comes back with any matched products attached.

## Local development

```bash
npm install
cp .env.example .env
# fill in STRIPE_SECRET_KEY with a test-mode key from
# https://dashboard.stripe.com/test/apikeys
npm run dev
```

The server starts on `http://localhost:4000` by default (`PORT` in `.env`).

## Deployment targets

The Express app in `src/app.ts` never calls `.listen()`, so each platform gets
a thin adapter and the application code stays identical:

| Target | Adapter | Notes |
| --- | --- | --- |
| Local / any Node host | `src/index.ts` | Plain `app.listen()` |
| AWS Lambda | `src/lambda.ts` | `serverless-http`, deployed with SAM |
| Vercel | `api/index.ts` | Exports the app; `vercel.json` rewrites all paths to it |

### AWS (Lambda + API Gateway)

Deployed as a single Lambda behind an HTTP API — Express still does the
routing, API Gateway is only the transport. Infrastructure lives in
`template.yaml` (AWS SAM); the TypeScript is bundled by esbuild, so
`node_modules` is never uploaded.

Prerequisites: an AWS account, the [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), and `aws configure` with credentials.

```bash
sam build
sam deploy --guided     # first time only — saves answers to samconfig.toml
```

The guided deploy asks for the four stack parameters (`AllowedOrigins`,
`FrontendUrl`, `StripeSecretKey`, `OpenAiApiKey`). On success it prints
`ApiUrl` — that's what the frontend's `REACT_APP_API_URL` should point at.

Afterwards:

```bash
npm run aws:deploy    # build + deploy
npm run aws:logs      # tail CloudWatch logs
```

**CI/CD.** `.github/workflows/deploy-aws.yml` type-checks and deploys on every
push to `main`. It needs these repository secrets: `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `ALLOWED_ORIGINS`, `FRONTEND_URL`,
`STRIPE_SECRET_KEY`, `OPENAI_API_KEY`.

**Cost.** Lambda's always-free allowance is 1M requests/month and API Gateway
bills per request; a portfolio demo stays comfortably inside it.

**Two things I'd change for a production deployment:** secrets are passed as
CloudFormation parameters (`NoEcho`) rather than being read from Secrets
Manager or SSM Parameter Store at runtime, and CI authenticates with a
long-lived access key instead of a GitHub OIDC role. Both are fine for a demo
stack and both are the first things I'd swap out for real customer data.

## Wiring up the frontend

In the frontend repo, point the RTK Query `baseUrl` at this backend's deployed URL (via an env var, e.g. `REACT_APP_API_URL`), and have the Checkout button POST to `${REACT_APP_API_URL}/api/checkout/session`.

## Why a real backend instead of a Vercel serverless function

Stripe's secret key can never live in the browser bundle — whatever creates the Checkout Session has to run server-side. A single serverless function works too, but a small standalone Express API is arguably more representative of how this looks in a real job: a separate service with its own deploy, its own env vars, and room to grow (add a database, more endpoints, auth, etc.) without being tied to a specific hosting platform's function format.
