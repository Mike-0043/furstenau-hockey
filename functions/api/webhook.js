/**
 * POST /api/webhook
 * Stripe webhook — fires after successful payment.
 * Set STRIPE_WEBHOOK_SECRET in env vars (from Stripe dashboard > Webhooks).
 */

import { saveBooking, sendConfirmationEmail } from './checkout.js';
import { errorResponse, jsonResponse } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  // Verify webhook signature
  if (env.STRIPE_WEBHOOK_SECRET && sig) {
    try {
      await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return errorResponse('Invalid signature', 400);
    }
  }

  const event = JSON.parse(body);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return jsonResponse({ received: true });

    const { eventId, playerName, parentName, email, phone } = session.metadata;
    const ev = await env.FHD_KV.get(`event:${eventId}`, 'json');
    if (!ev) return jsonResponse({ received: true });

    const booking = {
      id: `bk_${Date.now()}`,
      eventId, playerName, parentName: parentName || '',
      email, phone: phone || '',
      stripeSessionId: session.id,
      paid: true,
      amount: session.amount_total,
      createdAt: new Date().toISOString(),
    };

    await saveBooking(env, ev, booking);
    await sendConfirmationEmail(env, ev, booking);
  }

  return jsonResponse({ received: true });
}

async function verifyStripeSignature(body, sig, secret) {
  const parts = sig.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const payload = `${parts.t}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== parts.v1) throw new Error('Signature mismatch');
}
