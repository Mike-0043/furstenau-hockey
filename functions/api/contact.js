/**
 * Cloudflare Pages Function — POST /api/contact
 * Sends form submissions to Craig via Resend.
 *
 * Required environment variable (set in Cloudflare Pages dashboard):
 *   RESEND_API_KEY  — get yours free at resend.com
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();
    const { name, email, player, age, interest, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields.' }),
        { status: 400, headers }
      );
    }

    // Build email body
    const emailBody = `
New training inquiry from Furstenau Hockey Development website

Name:     ${name}
Email:    ${email}
Player:   ${player || '—'}
Age/Level: ${age || '—'}
Interest: ${interest || '—'}

Message:
${message}
    `.trim();

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
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

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Email failed to send.' }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error('Contact function error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error.' }),
      { status: 500, headers }
    );
  }
}

// Handle CORS preflight
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
