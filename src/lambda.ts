// AWS entrypoint. Same idea as api/index.ts (Vercel) and src/index.ts
// (a normal long-lived Node server): the Express app in ./app stays
// platform-agnostic, and each deployment target gets a thin adapter.
//
// serverless-http translates an API Gateway event into the (req, res) pair
// Express expects, so all routing, CORS and error handling still happen
// inside Express — API Gateway is only the transport.
import serverless from 'serverless-http';
import { app } from './app';

export const handler = serverless(app);
