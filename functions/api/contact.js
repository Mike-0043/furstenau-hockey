/**
 * POST /api/contact
 * Sends contact form submission directly to Craig via Resend.
 * Set RESEND_API_KEY env var — free at resend.com (3,000 emails/month).
 */

import { jsonResponse, errorResponse } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const { name, email, player, age, interest, message } = await request.json();

    if (!name || !email || !message) {
      return errorResponse('Missing required fields', 400);
    }

    const emailBody = `New training inquiry from furstenauhockey.com

Name:      ${name}
Email:     ${email}
Player:    ${player || '—'}
Age/Level: ${age || '—'}
Interest:  ${interest || '—'}

Message:
${message}
    `.trim();

    // If no Resend key, still return success (form works, just no email)
    if (!env.RESEND_API_KEY) {
      console.log('No RESEND_API_KEY set. Form submission:', emailBody);
      return jsonResponse({ success: true });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Furstenau Hockey <noreply@furstenauhockey.com>',
        to: ['craigfurstenau@hotmail.com'],
        reply_to: email,
        subject: `New Training Inquiry — ${name}`,
        text: emailBody,
      }),
    });

    if (!res.ok) {
      console.error('Resend error:', await res.text());
      return errorResponse('Email failed', 500);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return errorResponse('Server error', 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
