// Vercel auto-detects files under /api as serverless functions. Exporting
// the Express app directly here (instead of calling .listen()) lets Vercel
// treat every request as an invocation of this one function; vercel.json's
// rewrite sends all paths here so Express's own router still does the
// /health, /api/products etc. routing internally.
export { app as default } from '../src/app';
