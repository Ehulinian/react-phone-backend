import { Router } from 'express';
import Stripe from 'stripe';
import { CartLineItem } from '../types';

export const checkoutRouter = Router();

// Lazily created so a missing key fails with a clear error on first use
// instead of crashing the whole process at import time.
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  return new Stripe(secretKey);
}

checkoutRouter.post('/checkout/session', async (req, res) => {
  const { items } = req.body as { items?: CartLineItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  let stripe: Stripe;

  try {
    stripe = getStripeClient();
  } catch {
    return res
      .status(500)
      .json({ error: 'Stripe is not configured on the server' });
  }

  // The frontend's own origin, used to build the redirect URLs. Sent by the
  // client because this API can be called from more than one deployed
  // frontend (e.g. a preview URL and the production GitHub Pages site).
  const frontendOrigin =
    (req.body.frontendOrigin as string | undefined) ||
    req.headers.origin ||
    process.env.FRONTEND_URL;

  if (!frontendOrigin) {
    return res.status(400).json({ error: 'Missing frontend origin' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: items.map(item => ({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : undefined,
            metadata: { productId: item.id },
          },
        },
      })),
      // The frontend uses HashRouter, so the route lives after the `#`.
      success_url: `${frontendOrigin}/#/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendOrigin}/#/checkout/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Stripe session creation failed', error);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});
