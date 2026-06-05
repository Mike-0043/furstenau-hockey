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
    const { eventId, eventIds, playerName, parentName, email, phone, dob, team, relation, emergencyName, emergencyPhone } = body;

    if (!playerName || !email) return errorResponse('Missing required fields', 400);

    // Support multi-select: eventIds array or single eventId
    const ids = eventIds || [eventId];
    if (!ids || !ids.length) return errorResponse('No events selected', 400);

    // Load all events
    const events = [];
    for (const id of ids) {
      const ev = await env.FHD_KV.get(`event:${id}`, 'json');
      if (!ev) return errorResponse(`Event not found: ${id}`, 404);
      if (ev.capacity - ev.spotsBooked <= 0) return errorResponse(`"${ev.title}" is sold out`, 400);
      events.push(ev);
    }

    const totalAmount = events.reduce((s, e) => s + e.price, 0);
    const origin = new URL(request.url).origin;
    const titlesStr = events.map(e => e.title).join(', ');

    // ── MOCK MODE (no Stripe key set) ──
    if (!env.STRIPE_SECRET_KEY) {
      for (const ev of events) {
        const bookingId = `bk_${Date.now()}_${ev.id}`;
        const booking = {
          id: bookingId, eventId: ev.id, playerName, parentName: parentName || '',
          email, phone: phone || '', dob: dob || '', team: team || '',
          relation: relation || '', emergencyName: emergencyName || '', emergencyPhone: emergencyPhone || '',
          stripeSessionId: 'mock_' + bookingId,
          paid: true, amount: ev.price,
          createdAt: new Date().toISOString(),
        };
        await saveBooking(env, ev, booking);
      }
      // Send one confirmation email for all events
      await sendConfirmationEmail(env, events, { playerName, parentName: parentName || '', email, phone: phone || '', amount: totalAmount });
      return jsonResponse({ url: `${origin}/booking-success.html?mock=1&event=${encodeURIComponent(titlesStr)}&name=${encodeURIComponent(playerName)}` });
    }

    // ── REAL STRIPE MODE ──
    const metadata = { eventId, playerName, parentName: parentName || '', email, phone: phone || '' };

    // Build line items for each event
    const stripeBody = new URLSearchParams({
      'mode': 'payment',
      'customer_email': email,
      'success_url': `${origin}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${origin}/#schedule`,
      'metadata[playerName]': playerName,
      'metadata[parentName]': parentName || '',
      'metadata[email]': email,
      'metadata[phone]': phone || '',
      'metadata[eventIds]': ids.join(','),
    });

    events.forEach((ev, i) => {
      stripeBody.append(`line_items[${i}][price_data][currency]`, 'usd');
      stripeBody.append(`line_items[${i}][price_data][product_data][name]`, ev.title);
      stripeBody.append(`line_items[${i}][price_data][product_data][description]`, `${ev.date}${ev.time ? ' · ' + ev.time : ''}${ev.location ? ' · ' + ev.location : ''}`);
      stripeBody.append(`line_items[${i}][price_data][unit_amount]`, String(ev.price));
      stripeBody.append(`line_items[${i}][quantity]`, '1');
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

async function sendConfirmationEmail(env, evOrEvents, booking) {
  if (!env.RESEND_API_KEY) return;
  const events = Array.isArray(evOrEvents) ? evOrEvents : [evOrEvents];
  const ev = events[0];
  const totalAmount = booking.amount || events.reduce((s, e) => s + e.price, 0);
  const priceStr = `$${(totalAmount / 100).toFixed(2)}`;
  const sessionLines = events.map(e => {
    const d = new Date(e.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `• ${e.title} — ${d}${e.time ? ' at ' + e.time : ''}${e.location ? ', ' + e.location : ''} — $${(e.price/100).toFixed(2)}`;
  }).join('\n');

  // Email to Craig
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Furstenau Hockey <onboarding@resend.dev>',
      to: ['craigfurstenau@hotmail.com'],
      subject: `New Booking — ${booking.playerName} — ${events.length} session${events.length>1?'s':''}`,
      text: `New booking received!\n\nPlayer: ${booking.playerName}\nParent/Guardian: ${booking.parentName || '—'}\nEmail: ${booking.email}\nPhone: ${booking.phone || '—'}\n\nSessions Booked:\n${sessionLines}\n\nTotal Paid: ${priceStr}`,
    }),
  });

  // Confirmation email to parent/player
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Furstenau Hockey <onboarding@resend.dev>',
      to: [booking.email],
      reply_to: 'craigfurstenau@hotmail.com',
      subject: `Booking Confirmed — ${events.length} session${events.length>1?'s':''} — Furstenau Hockey`,
      text: `You're booked!\n\nHi ${booking.parentName || booking.playerName},\n\nYour spot${events.length>1?'s have':' has'} been confirmed:\n\n${sessionLines}\n\nPlayer: ${booking.playerName}\nTotal Paid: ${priceStr}\n\nIf you have any questions, reply to this email or contact Craig at craigfurstenau@hotmail.com.\n\nSee you on the ice!\n— Furstenau Hockey Development`,
    }),
  });
}

export { saveBooking, sendConfirmationEmail };

/**
 * STRIPE CONNECT — READY TO ACTIVATE
 * 
 * When ready to take your platform fee:
 * 
 * 1. Create a Stripe Connect account at stripe.com/connect
 * 2. Get your platform's Stripe secret key
 * 3. Add these env vars in Cloudflare Pages dashboard:
 *    - STRIPE_SECRET_KEY = your platform Stripe secret key (sk_live_...)
 *    - STRIPE_PLATFORM_FEE_PERCENT = 7  (or 5-8, your choice)
 *    - CRAIG_STRIPE_ACCOUNT_ID = Craig's connected Stripe account ID (acct_...)
 * 
 * 4. Craig goes to your Connect onboarding link and connects his Stripe
 * 5. Swap the stripeBody below with the CONNECT version
 * 
 * CONNECT VERSION (swap in when ready):
 * 
 * const feePercent = parseInt(env.STRIPE_PLATFORM_FEE_PERCENT || '7') / 100;
 * const platformFee = Math.round(ev.price * feePercent); // e.g. 7% of price in cents
 * 
 * stripeBody.append('application_fee_amount', String(platformFee));
 * stripeBody.append('transfer_data[destination]', env.CRAIG_STRIPE_ACCOUNT_ID);
 * 
 * That's it — Stripe handles the split automatically.
 * Craig gets (price - platformFee - stripe fees), you get platformFee.
 */
