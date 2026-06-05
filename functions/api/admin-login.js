/**
 * POST /api/admin-login
 * Checks password, returns a session token stored in KV.
 * Set ADMIN_PASSWORD env var in Cloudflare Pages dashboard.
 */

import { jsonResponse, errorResponse } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const { password } = await request.json();
    const correct = env.ADMIN_PASSWORD || 'fhd-admin-2025';

    if (password !== correct) {
      return errorResponse('Incorrect password', 401);
    }

    const token = crypto.randomUUID();
    const expires = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
    await env.FHD_KV.put(`session:${token}`, JSON.stringify({ expires }), { expirationTtl: 28800 });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `fhd_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800`,
      },
    });
  } catch (e) {
    return errorResponse('Server error', 500);
  }
}
