/**
 * POST /api/waiver — save waiver acceptance for a booking
 * GET  /api/waiver?bookingId=xxx — get waiver status for a booking (admin)
 */

import { jsonResponse, errorResponse, verifyAdmin } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { bookingId, signerName, signerEmail, playerName, isMinor, parentName, ipAddress } = body;

    if (!bookingId || !signerName || !signerEmail) {
      return errorResponse('Missing required fields', 400);
    }

    const waiver = {
      bookingId,
      signerName,
      signerEmail,
      playerName,
      isMinor: !!isMinor,
      parentName: parentName || null,
      acceptedAt: new Date().toISOString(),
      ipAddress: ipAddress || 'unknown',
      terms: 'v1.0',
    };

    await env.FHD_KV.put(`waiver:${bookingId}`, JSON.stringify(waiver));
    return jsonResponse({ success: true });
  } catch (e) {
    return errorResponse('Server error', 500);
  }
}

export async function onRequestGet({ request, env }) {
  if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
  const url = new URL(request.url);
  const bookingId = url.searchParams.get('bookingId');
  if (!bookingId) return errorResponse('Missing bookingId', 400);
  const waiver = await env.FHD_KV.get(`waiver:${bookingId}`, 'json');
  if (!waiver) return errorResponse('Waiver not found', 404);
  return jsonResponse(waiver);
}
