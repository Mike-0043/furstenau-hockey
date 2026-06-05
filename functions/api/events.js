/**
 * GET  /api/events        — list all active events (public)
 * POST /api/events        — create event (admin only)
 */

import { verifyAdmin, cors, jsonResponse, errorResponse } from '../_utils.js';

export async function onRequestGet({ env }) {
  try {
    const list = await env.FHD_KV.get('events:list', 'json') || [];
    const events = [];
    for (const id of list) {
      const ev = await env.FHD_KV.get(`event:${id}`, 'json');
      if (ev && ev.active) events.push(ev);
    }
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    return jsonResponse(events);
  } catch (e) {
    return errorResponse('Failed to load events', 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
  try {
    const body = await request.json();
    const id = `ev_${Date.now()}`;
    const event = {
      id,
      title:       body.title,
      type:        body.type,
      description: body.description,
      date:        body.date,
      time:        body.time,
      duration:    body.duration,
      location:    body.location,
      price:       parseInt(body.price),       // in cents
      capacity:    parseInt(body.capacity),
      spotsBooked: 0,
      active:      true,
      createdAt:   new Date().toISOString(),
    };
    const list = await env.FHD_KV.get('events:list', 'json') || [];
    list.push(id);
    await env.FHD_KV.put('events:list', JSON.stringify(list));
    await env.FHD_KV.put(`event:${id}`, JSON.stringify(event));
    return jsonResponse(event, 201);
  } catch (e) {
    return errorResponse('Failed to create event', 500);
  }
}
