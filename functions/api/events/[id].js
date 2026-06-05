/**
 * GET    /api/events/:id   — single event (public)
 * PUT    /api/events/:id   — update event (admin)
 * DELETE /api/events/:id   — delete event (admin)
 */

import { verifyAdmin, jsonResponse, errorResponse } from '../../_utils.js';

export async function onRequestGet({ params, env }) {
  const ev = await env.FHD_KV.get(`event:${params.id}`, 'json');
  if (!ev) return errorResponse('Event not found', 404);
  return jsonResponse(ev);
}

export async function onRequestPut({ request, params, env }) {
  if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
  const ev = await env.FHD_KV.get(`event:${params.id}`, 'json');
  if (!ev) return errorResponse('Event not found', 404);
  const body = await request.json();
  const updated = {
    ...ev,
    title:       body.title       ?? ev.title,
    type:        body.type        ?? ev.type,
    description: body.description ?? ev.description,
    date:        body.date        ?? ev.date,
    time:        body.time        ?? ev.time,
    duration:    body.duration    ?? ev.duration,
    location:    body.location    ?? ev.location,
    price:       body.price != null ? parseInt(body.price) : ev.price,
    capacity:    body.capacity != null ? parseInt(body.capacity) : ev.capacity,
    active:      body.active      ?? ev.active,
  };
  await env.FHD_KV.put(`event:${params.id}`, JSON.stringify(updated));
  return jsonResponse(updated);
}

export async function onRequestDelete({ request, params, env }) {
  if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
  const ev = await env.FHD_KV.get(`event:${params.id}`, 'json');
  if (!ev) return errorResponse('Event not found', 404);
  // Soft delete
  await env.FHD_KV.put(`event:${params.id}`, JSON.stringify({ ...ev, active: false }));
  return jsonResponse({ success: true });
}
