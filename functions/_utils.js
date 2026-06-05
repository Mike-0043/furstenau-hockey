/**
 * Shared utilities for Pages Functions
 */

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function verifyAdmin(request, env) {
  // Check cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const token = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('fhd_admin='))?.split('=')?.[1];
  if (!token) return false;

  const session = await env.FHD_KV.get(`session:${token}`, 'json');
  if (!session) return false;
  if (Date.now() > session.expires) return false;

  return true;
}

export function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
}
