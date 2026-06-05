/**
 * POST /api/admin-login         — login
 * POST /api/admin-login?action=change  — change password (requires current session)
 * POST /api/admin-login?action=forgot  — sends reset link to Craig's email
 * POST /api/admin-login?action=reset   — resets password via token
 */

import { jsonResponse, errorResponse, verifyAdmin } from '../_utils.js';

async function checkPassword(password, env) {
  // The ADMIN_PASSWORD env var ALWAYS works as a master key (recovery method)
  const masterKey = env.ADMIN_PASSWORD || 'fhd-admin-2025';
  if (password === masterKey) return true;
  // Also check KV password (set when changed via admin panel)
  const kvPassword = await env.FHD_KV.get('admin:password', 'text');
  return kvPassword ? password === kvPassword : false;
}

async function getPassword(env) {
  const kvPassword = await env.FHD_KV.get('admin:password', 'text');
  return kvPassword || env.ADMIN_PASSWORD || 'fhd-admin-2025';
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    // ── CHANGE PASSWORD ──
    if (action === 'change') {
      if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
      const { currentPassword, newPassword } = await request.json();
      const correct = await getPassword(env);
      if (currentPassword !== correct) return errorResponse('Current password is incorrect', 401);
      if (!newPassword || newPassword.length < 6) return errorResponse('New password must be at least 6 characters', 400);
      await env.FHD_KV.put('admin:password', newPassword);
      return jsonResponse({ success: true });
    }

    // ── FORGOT PASSWORD — send reset link ──
    if (action === 'forgot') {
      const resetToken = crypto.randomUUID();
      await env.FHD_KV.put(`reset:${resetToken}`, '1', { expirationTtl: 3600 }); // 1 hour

      const origin = new URL(request.url).origin;
      const resetUrl = `${origin}/admin?reset=${resetToken}`;

      if (env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Furstenau Hockey <onboarding@resend.dev>',
            to: ['craigfurstenau@hotmail.com'],
            subject: 'Admin Panel — Password Reset',
            text: `You requested a password reset for the Furstenau Hockey admin panel.\n\nClick this link to reset your password (expires in 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
          }),
        });
      }

      return jsonResponse({ success: true, resetUrl }); // return URL for testing without email
    }

    // ── RESET PASSWORD via token ──
    if (action === 'reset') {
      const { token, newPassword } = await request.json();
      if (!token || !newPassword) return errorResponse('Missing fields', 400);
      const valid = await env.FHD_KV.get(`reset:${token}`, 'text');
      if (!valid) return errorResponse('Reset link expired or invalid', 400);
      if (newPassword.length < 6) return errorResponse('Password must be at least 6 characters', 400);
      await env.FHD_KV.put('admin:password', newPassword);
      await env.FHD_KV.delete(`reset:${token}`);
      return jsonResponse({ success: true });
    }

    // ── LOGIN ──
    const { password } = await request.json();
    if (!await checkPassword(password, env)) return errorResponse('Incorrect password', 401);

    const token = crypto.randomUUID();
    const expires = Date.now() + 8 * 60 * 60 * 1000;
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
