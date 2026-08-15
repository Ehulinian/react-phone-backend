// Local dev / non-Vercel deployments (Render, Railway, Fly, etc.) run the
// app as a regular long-lived Node server. Vercel instead imports `app`
// directly from ./app and handles requests itself — see api/index.ts.
import { app } from './app';

const port = process.env.PORT || 4000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`phone-catalog-backend listening on port ${port}`);
});
