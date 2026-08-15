import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { productsRouter } from './routes/products';
import { checkoutRouter } from './routes/checkout';
import { assistantRouter } from './routes/assistant';

// The Express app itself, with no `.listen()` call — that part differs
// between "run locally with `npm run dev`" and "run as a Vercel serverless
// function" (see src/index.ts vs api/index.ts).
export const app = express();

// Browsers send `Origin` as scheme + host only, never with a path or a
// trailing slash. Normalising both sides means a value like
// "https://user.github.io/repo/" in ALLOWED_ORIGINS still matches, instead
// of silently failing every request with an opaque CORS error.
function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}

// Comma-separated list of allowed origins, e.g.
// "https://username.github.io,http://localhost:3000"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools with no Origin header (curl, health checks) and any
      // origin explicitly allow-listed above.
      if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
      } else {
        callback(
          new Error(
            `Origin ${origin} is not allowed. Allowed: ${allowedOrigins.join(', ')}`,
          ),
        );
      }
    },
  }),
);

app.use(express.json());

// Exposes the parsed allow-list so a CORS misconfiguration can be diagnosed
// by just opening this URL, instead of guessing from the browser console.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    allowedOrigins,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    assistantConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.use('/api', productsRouter);
app.use('/api', checkoutRouter);
app.use('/api', assistantRouter);

// Catches the CORS rejection thrown above (and anything else uncaught) and
// returns clean JSON instead of Express's default HTML error page.
// eslint-disable-next-line no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err.message);
  res.status(err.message.includes('not allowed') ? 403 : 500).json({
    error: err.message,
  });
});
