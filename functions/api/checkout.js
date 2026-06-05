/**
 * POST /api/checkout
 * Creates a Stripe Checkout session for an event booking.
 * Set STRIPE_SECRET_KEY env var to a test key (sk_test_...) to use test mode.
 * Test card: 4242 4242 4242 4242 | any future date | any CVC
 */

import { jsonResponse, errorResponse } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { eventId, playerName, parentName, email, phone } = body;

    if (!eventId || !playerName || !email) {
      return errorResponse('Missing required fields', 400);
    }

    // Load event
    const ev = await env.FHD_KV.get(`event:${eventId}`, 'json');
    if (!ev) return errorResponse('Event not found', 404);

    const spotsLeft = ev.capacity - ev.spotsBooked;
    if (spotsLeft <= 0) return errorResponse('This event is sold out', 400);

    const origin = new URL(request.url).origin;

    // ── MOCK MODE (no Stripe key set) ──
    if (!env.STRIPE_SECRET_KEY) {
      const bookingId = `bk_${Date.now()}`;
      const booking = {
        id: bookingId, eventId, playerName, parentName: parentName || '',
        email, phone: phone || '',
        stripeSessionId: 'mock_' + bookingId,
        paid: true, amount: ev.price,
        createdAt: new Date().toISOString(),
      };
      await saveBooking(env, ev, booking);
      await sendConfirmationEmail(env, ev, booking);
      return jsonResponse({ url: `${origin}/booking-success.html?mock=1&event=${encodeURIComponent(ev.title)}&name=${encodeURIComponent(playerName)}` });
    }

    // ── REAL STRIPE MODE ──
    const metadata = { eventId, playerName, parentName: parentName || '', email, phone: phone || '' };

    const stripeBody = new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': ev.title,
      'line_items[0][price_data][product_data][description]': `${ev.date} · ${ev.time} · ${ev.location}`,
      'line_items[0][price_data][unit_amount]': String(ev.price),
      'line_items[0][quantity]': '1',
      'mode': 'payment',
      'customer_email': email,
      'success_url': `${origin}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${origin}/#schedule`,
      'metadata[eventId]': eventId,
      'metadata[playerName]': playerName,
      'metadata[parentName]': parentName || '',
      'metadata[email]': email,
      'metadata[phone]': phone || '',
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeBody.toString(),
    });

    if (!stripeRes.ok) {
      const err = await stripeRes.text();
      console.error('Stripe error:', err);
      return errorResponse('Payment setup failed', 500);
    }

    const session = await stripeRes.json();
    return jsonResponse({ url: session.url });

  } catch (e) {
    console.error('Checkout error:', e);
    return errorResponse('Server error', 500);
  }
}

// ── Helpers ──

async function saveBooking(env, ev, booking) {
  // Save booking
  await env.FHD_KV.put(`booking:${booking.id}`, JSON.stringify(booking));
  // Add to event's booking list
  const eventBookings = await env.FHD_KV.get(`event:${ev.id}:bookings`, 'json') || [];
  eventBookings.push(booking.id);
  await env.FHD_KV.put(`event:${ev.id}:bookings`, JSON.stringify(eventBookings));
  // Increment spots booked
  const updatedEv = { ...ev, spotsBooked: ev.spotsBooked + 1 };
  await env.FHD_KV.put(`event:${ev.id}`, JSON.stringify(updatedEv));
}

async function sendConfirmationEmail(env, ev, booking) {
  if (!env.RESEND_API_KEY) return;
  const dateStr = new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const priceStr = `$${(ev.price / 100).toFixed(2)}`;

  // Email to Craig
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Furstenau Hockey <noreply@furstenauhockey.com>',
      to: ['craigfurstenau@hotmail.com'],
      subject: `New Booking — ${ev.title} — ${booking.playerName}`,
      text: `New booking received!\n\nEvent: ${ev.title}\nDate: ${dateStr} at ${ev.time}\nLocation: ${ev.location}\n\nPlayer: ${booking.playerName}\nParent/Guardian: ${booking.parentName || '—'}\nEmail: ${booking.email}\nPhone: ${booking.phone || '—'}\nAmount Paid: ${priceStr}\n\nSpots remaining: ${ev.capacity - ev.spotsBooked - 1} of ${ev.capacity}`,
    }),
  });

  // Confirmation email to parent/player
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Furstenau Hockey <noreply@furstenauhockey.com>',
      to: [booking.email],
      reply_to: 'craigfurstenau@hotmail.com',
      subject: `Booking Confirmed — ${ev.title}`,
      text: `You're booked!\n\nHi ${booking.parentName || booking.playerName},\n\nYour spot has been confirmed for:\n\n${ev.title}\n${dateStr} at ${ev.time}\n${ev.location}\n\nPlayer: ${booking.playerName}\nAmount Paid: ${priceStr}\n\nIf you have any questions, reply to this email or contact Craig directly at craigfurstenau@hotmail.com.\n\nSee you on the ice!\n— Furstenau Hockey Development`,
    }),
  });
}

export { saveBooking, sendConfirmationEmail };
