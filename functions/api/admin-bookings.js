/**
 * GET /api/admin-bookings?eventId=xxx
 * Returns all bookings for an event (admin only).
 */

import { verifyAdmin, jsonResponse, errorResponse } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);

  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');

  if (eventId) {
    const bookingIds = await env.FHD_KV.get(`event:${eventId}:bookings`, 'json') || [];
    const bookings = [];
    for (const id of bookingIds) {
      const b = await env.FHD_KV.get(`booking:${id}`, 'json');
      if (b) bookings.push(b);
    }
    return jsonResponse(bookings);
  }

  // Return all events with booking counts
  const list = await env.FHD_KV.get('events:list', 'json') || [];
  const summary = [];
  for (const id of list) {
    const ev = await env.FHD_KV.get(`event:${id}`, 'json');
    if (ev) summary.push({
      id: ev.id, title: ev.title, date: ev.date, type: ev.type,
      capacity: ev.capacity, spotsBooked: ev.spotsBooked,
      spotsLeft: ev.capacity - ev.spotsBooked, active: ev.active,
      price: ev.price,
    });
  }
  return jsonResponse(summary);
}
