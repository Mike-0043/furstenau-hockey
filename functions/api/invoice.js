/**
 * POST /api/invoice        — create & send invoice (admin)
 * GET  /api/invoice?id=xxx — view invoice (public, for pay link)
 * GET  /api/invoice/list   — list all invoices (admin)
 */

import { verifyAdmin, jsonResponse, errorResponse } from '../_utils.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    // List invoices (admin)
    if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);
    const list = await env.FHD_KV.get('invoices:list', 'json') || [];
    const invoices = [];
    for (const invId of list) {
      const inv = await env.FHD_KV.get(`invoice:${invId}`, 'json');
      if (inv) invoices.push(inv);
    }
    invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return jsonResponse(invoices);
  }

  // View single invoice as HTML page
  const inv = await env.FHD_KV.get(`invoice:${id}`, 'json');
  if (!inv) return new Response('Invoice not found', { status: 404 });

  return new Response(renderInvoiceHTML(inv), {
    headers: { 'Content-Type': 'text/html' }
  });
}

export async function onRequestPost({ request, env }) {
  if (!await verifyAdmin(request, env)) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const { clientName, clientEmail, serviceDescription, amount, dueDate, notes } = body;

    if (!clientName || !clientEmail || !serviceDescription || !amount) {
      return errorResponse('Missing required fields', 400);
    }

    // Generate invoice number
    const invoiceCount = await env.FHD_KV.get('invoices:count', 'text') || '0';
    const invoiceNum = parseInt(invoiceCount) + 1;
    await env.FHD_KV.put('invoices:count', String(invoiceNum));

    const id = `inv_${Date.now()}`;
    const origin = new URL(request.url).origin;

    const invoice = {
      id,
      invoiceNumber: `FHD-${String(invoiceNum).padStart(4, '0')}`,
      clientName,
      clientEmail,
      serviceDescription,
      amount: Math.round(parseFloat(amount) * 100), // store in cents
      dueDate: dueDate || null,
      notes: notes || '',
      status: 'sent',
      viewUrl: `${origin}/api/invoice?id=${id}`,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };

    // Save invoice
    await env.FHD_KV.put(`invoice:${id}`, JSON.stringify(invoice));
    const list = await env.FHD_KV.get('invoices:list', 'json') || [];
    list.push(id);
    await env.FHD_KV.put('invoices:list', JSON.stringify(list));

    // Send email via Resend
    if (env.RESEND_API_KEY) {
      await sendInvoiceEmail(env, invoice);
    }

    return jsonResponse(invoice, 201);
  } catch (e) {
    console.error('Invoice error:', e);
    return errorResponse('Server error', 500);
  }
}

async function sendInvoiceEmail(env, inv) {
  const priceStr = `$${(inv.amount / 100).toFixed(2)}`;
  const dueDateStr = inv.dueDate
    ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Upon receipt';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Furstenau Hockey <onboarding@resend.dev>',
      to: [inv.clientEmail],
      reply_to: 'craigfurstenau@hotmail.com',
      subject: `Invoice ${inv.invoiceNumber} — Furstenau Hockey Development`,
      html: renderInvoiceEmailHTML(inv, priceStr, dueDateStr),
    }),
  });

  // Notify Craig
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Furstenau Hockey <onboarding@resend.dev>',
      to: ['craigfurstenau@hotmail.com'],
      subject: `Invoice Sent — ${inv.invoiceNumber} — ${inv.clientName}`,
      text: `Invoice ${inv.invoiceNumber} sent to ${inv.clientName} (${inv.clientEmail})\nAmount: $${(inv.amount/100).toFixed(2)}\nDue: ${dueDateStr}\nService: ${inv.serviceDescription}\nView: ${inv.viewUrl}`,
    }),
  });
}

function renderInvoiceHTML(inv) {
  const priceStr = `$${(inv.amount / 100).toFixed(2)}`;
  const dueDateStr = inv.dueDate
    ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Upon receipt';
  const createdStr = new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${inv.invoiceNumber} — Furstenau Hockey</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f6f9;color:#1a1a2e;padding:40px 20px}
    .invoice{background:#fff;max-width:700px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
    .inv-header{background:#0d1014;color:#fff;padding:36px 40px;display:flex;justify-content:space-between;align-items:center}
    .inv-brand{display:flex;flex-direction:column;gap:2px}
    .inv-brand strong{font-size:20px;font-weight:700;letter-spacing:0.06em}
    .inv-brand span{font-size:11px;color:#3a8fd8;letter-spacing:0.16em;text-transform:uppercase}
    .inv-num{text-align:right}
    .inv-num .label{font-size:11px;color:#7a8590;text-transform:uppercase;letter-spacing:0.1em}
    .inv-num .value{font-size:28px;font-weight:700;color:#3a8fd8}
    .inv-body{padding:40px}
    .inv-meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:36px}
    .meta-block label{font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#7a8590;display:block;margin-bottom:6px}
    .meta-block p{font-size:14px;color:#1a1a2e}
    .inv-table{width:100%;border-collapse:collapse;margin-bottom:32px}
    .inv-table th{background:#f4f6f9;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#7a8590;padding:12px 16px;text-align:left}
    .inv-table td{padding:16px;border-bottom:1px solid #edf2f7;font-size:14px}
    .inv-total{text-align:right;padding:16px 0;border-top:2px solid #0d1014}
    .inv-total .total-label{font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#7a8590;margin-right:16px}
    .inv-total .total-amount{font-size:28px;font-weight:700;color:#1a6fbe}
    .inv-notes{background:#f4f6f9;border-radius:8px;padding:16px 20px;margin-bottom:32px}
    .inv-notes label{font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#7a8590;display:block;margin-bottom:6px}
    .inv-notes p{font-size:13px;color:#4a5568}
    .inv-pay{background:linear-gradient(135deg,#1a6fbe,#3a8fd8);border-radius:8px;padding:24px;text-align:center;margin-bottom:32px}
    .inv-pay p{color:rgba(255,255,255,0.8);font-size:13px;margin-bottom:4px}
    .inv-pay strong{color:#fff;font-size:15px}
    .inv-footer{text-align:center;padding:24px 40px;border-top:1px solid #edf2f7;color:#a0aec0;font-size:12px}
    .status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
    .status-sent{background:#e8f4fd;color:#1a6fbe}
    .status-paid{background:#e6f9f0;color:#27ae60}
    @media print{body{background:#fff;padding:0}.invoice{box-shadow:none;border-radius:0}}
  </style>
</head>
<body>
<div class="invoice">
  <div class="inv-header">
    <div class="inv-brand">
      <strong>FURSTENAU HOCKEY</strong>
      <span>Hockey Development</span>
      <span style="font-size:11px;color:#7a8590;margin-top:4px">craigfurstenau@hotmail.com</span>
    </div>
    <div class="inv-num">
      <div class="label">Invoice</div>
      <div class="value">${inv.invoiceNumber}</div>
      <span class="status-badge ${inv.status === 'paid' ? 'status-paid' : 'status-sent'}">${inv.status}</span>
    </div>
  </div>
  <div class="inv-body">
    <div class="inv-meta">
      <div class="meta-block">
        <label>Billed To</label>
        <p><strong>${inv.clientName}</strong></p>
        <p>${inv.clientEmail}</p>
      </div>
      <div class="meta-block">
        <div style="margin-bottom:12px">
          <label>Invoice Date</label>
          <p>${createdStr}</p>
        </div>
        <div>
          <label>Due Date</label>
          <p><strong>${dueDateStr}</strong></p>
        </div>
      </div>
    </div>

    <table class="inv-table">
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>${inv.serviceDescription}</td>
          <td style="text-align:right;font-weight:600">${priceStr}</td>
        </tr>
      </tbody>
    </table>
    <div class="inv-total">
      <span class="total-label">Total Due</span>
      <span class="total-amount">${priceStr}</span>
    </div>

    ${inv.notes ? `<div class="inv-notes"><label>Notes</label><p>${inv.notes}</p></div>` : ''}

    <div class="inv-pay">
      <p>To pay by check, make payable to <strong>Craig Furstenau</strong></p>
      <strong>Questions? craigfurstenau@hotmail.com</strong>
    </div>

    <div style="text-align:center;margin-bottom:16px">
      <button onclick="window.print()" style="background:#1a6fbe;color:#fff;border:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.04em">Print / Save as PDF</button>
    </div>
  </div>
  <div class="inv-footer">Furstenau Hockey Development · Michigan · craigfurstenau@hotmail.com</div>
</div>
</body>
</html>`;
}

function renderInvoiceEmailHTML(inv, priceStr, dueDateStr) {
  const createdStr = new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:32px 16px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#0d1014;padding:28px 32px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.06em">FURSTENAU HOCKEY</div>
        <div style="color:#3a8fd8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase">Hockey Development</div>
      </div>
      <div style="text-align:right">
        <div style="color:#7a8590;font-size:10px;text-transform:uppercase;letter-spacing:0.1em">Invoice</div>
        <div style="color:#3a8fd8;font-size:24px;font-weight:700">${inv.invoiceNumber}</div>
      </div>
    </div>
    <div style="padding:32px">
      <p style="color:#4a5568;font-size:14px;margin-bottom:24px">Hi ${inv.clientName},<br><br>Please find your invoice from Furstenau Hockey Development below.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#f4f6f9">
          <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:0.1em;color:#7a8590;text-transform:uppercase">Description</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:0.1em;color:#7a8590;text-transform:uppercase">Amount</th>
        </tr>
        <tr>
          <td style="padding:14px;border-bottom:1px solid #edf2f7;font-size:14px">${inv.serviceDescription}</td>
          <td style="padding:14px;border-bottom:1px solid #edf2f7;font-size:14px;text-align:right;font-weight:600">${priceStr}</td>
        </tr>
      </table>
      <div style="text-align:right;padding:12px 0;border-top:2px solid #0d1014;margin-bottom:24px">
        <span style="font-size:12px;color:#7a8590;text-transform:uppercase;letter-spacing:0.1em;margin-right:12px">Total Due</span>
        <span style="font-size:26px;font-weight:700;color:#1a6fbe">${priceStr}</span>
      </div>
      <div style="background:#f4f6f9;border-radius:8px;padding:14px 18px;margin-bottom:24px">
        <div style="font-size:11px;color:#7a8590;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Due Date</div>
        <div style="font-size:14px;font-weight:600;color:#1a1a2e">${dueDateStr}</div>
      </div>
      ${inv.notes ? `<div style="background:#f4f6f9;border-radius:8px;padding:14px 18px;margin-bottom:24px"><div style="font-size:11px;color:#7a8590;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Notes</div><div style="font-size:13px;color:#4a5568">${inv.notes}</div></div>` : ''}
      <div style="text-align:center;background:linear-gradient(135deg,#1a6fbe,#3a8fd8);border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0 0 4px">View your invoice online</p>
        <a href="${inv.viewUrl}" style="color:#fff;font-size:14px;font-weight:600">${inv.viewUrl}</a>
      </div>
      <p style="color:#a0aec0;font-size:12px;text-align:center">Questions? Reply to this email or contact Craig at craigfurstenau@hotmail.com</p>
    </div>
  </div>
</body>
</html>`;
}
