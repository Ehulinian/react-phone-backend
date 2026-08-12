import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { productsRouter } from './routes/products';
import { checkoutRouter } from './routes/checkout';

const app = express();
const port = process.env.PORT || 4000;

// Comma-separated list of allowed origins, e.g.
// "https://username.github.io,http://localhost:3000"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools with no Origin header (curl, health checks) and any
      // origin explicitly allow-listed above.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed`));
      }
    },
  }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', productsRouter);
app.use('/api', checkoutRouter);

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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`phone-catalog-backend listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
