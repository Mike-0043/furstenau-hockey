// ── Mobile nav toggle ──
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const header = document.getElementById('site-header');

toggle?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});

navLinks?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Header scroll shadow ──
window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ── Reveal on scroll (IntersectionObserver) ──
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Animated counters ──
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1600;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(ease * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

// ── Active nav highlight on scroll ──
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.classList.toggle('active-nav', a.getAttribute('href') === `#${entry.target.id}`);
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));

// ── Clip switcher ──
const mainPlayer = document.getElementById('main-player');
const clipTitleEl = document.getElementById('clip-title');
const clipDescEl = document.getElementById('clip-desc');
const clipItems = document.querySelectorAll('.clip-item');
const shareFb = document.getElementById('share-fb');
const shareTw = document.getElementById('share-tw');

clipItems.forEach(item => {
  item.addEventListener('click', () => {
    clipItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const id = item.dataset.id;
    const title = item.dataset.title;
    const desc = item.dataset.desc;

    if (mainPlayer) mainPlayer.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
    if (clipTitleEl) clipTitleEl.textContent = title;
    if (clipDescEl) clipDescEl.textContent = desc;

    const ytUrl = `https://www.youtube.com/watch?v=${id}`;
    if (shareFb) shareFb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ytUrl)}`;
    if (shareTw) shareTw.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(ytUrl)}&text=${encodeURIComponent('Check out this Furstenau Hockey clip: ' + title)}`;
  });
});

// ── Copy link ──
function copyLink(btn, url) {
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = orig, 2200);
  });
}

// ── Contact form ──
async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const note = document.getElementById('form-note');
  const btn = form.querySelector('button[type="submit"]');
  note.textContent = '';
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     form.name.value,
        email:    form.email.value,
        player:   form.player.value,
        age:      form.age.value,
        interest: form.interest.value,
        message:  form.message.value,
      }),
    });
    note.style.color = res.ok ? '#3a8fd8' : '#e74c3c';
    note.textContent = res.ok
      ? '✓ Message sent! Craig will be in touch soon.'
      : '✗ Something went wrong — email Craig directly at craigfurstenau@hotmail.com';
    if (res.ok) form.reset();
  } catch {
    note.style.color = '#e74c3c';
    note.textContent = '✗ Network error — email Craig at craigfurstenau@hotmail.com';
  }

  btn.textContent = 'Send Message';
  btn.disabled = false;
}

// ── Time formatter (24hr → 12hr) ──
function fmt12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ── Events / Schedule ──
async function loadEvents() {
  const container = document.getElementById('events-container');
  if (!container) return;

  try {
    const res = await fetch('/api/events');
    const events = await res.json();

    if (!events.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:48px 0;color:var(--text-dim)">
          <p style="font-size:16px">No events scheduled yet.</p>
          <p style="font-size:13px;margin-top:8px">Check back soon or <a href="#contact" style="color:var(--blue-light)">contact Craig</a> for availability.</p>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="events-grid">${events.map(ev => eventCard(ev)).join('')}</div>`;
    // Re-observe newly added reveal elements
    container.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  } catch {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 0;color:var(--text-dim)">
        <p>Could not load schedule. <a href="#contact" style="color:var(--blue-light)">Contact Craig directly.</a></p>
      </div>`;
  }
}

// ── Cart (multi-select) ──
let _cart = {}; // { eventId: eventObject }
let _waiverAccepted = false;
let _pendingCartEvent = null;

// ── Waiver Gate ──
function toggleCart(ev) {
  // If removing — no waiver needed
  if (_cart[ev.id]) {
    delete _cart[ev.id];
    updateCartBar();
    const btn = document.getElementById(`select-btn-${ev.id}`);
    const card = document.getElementById(`event-card-${ev.id}`);
    if (btn) { btn.textContent = 'Select'; btn.classList.remove('selected'); }
    if (card) card.classList.remove('selected');
    return;
  }

  // If adding — show waiver gate first (only if not already accepted)
  if (!_waiverAccepted) {
    _pendingCartEvent = ev;
    showWaiverGate();
    return;
  }

  addToCart(ev);
}

function showWaiverGate() {
  document.getElementById('waiver-gate-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset state
  const checkbox = document.getElementById('waiver-gate-check');
  const btn = document.getElementById('waiver-gate-btn');
  const note = document.getElementById('waiver-scroll-note');
  const label = document.getElementById('waiver-gate-label');
  checkbox.checked = false;
  checkbox.disabled = true;
  btn.disabled = true;
  note.style.display = 'block';
  label.style.color = 'var(--text-dim)';
  label.textContent = 'Scroll to read the full agreement before accepting';

  // Listen for scroll
  const scroll = document.getElementById('waiver-gate-scroll');
  scroll.scrollTop = 0;
  const onScroll = () => {
    const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 20;
    if (atBottom) {
      checkbox.disabled = false;
      note.style.display = 'none';
      label.style.color = 'var(--text)';
      label.textContent = 'I have read and agree to the Participation Agreement, Liability Waiver, No Refund Policy, and Equipment Requirements. If registering a minor, I confirm I am the parent or legal guardian.';
      scroll.removeEventListener('scroll', onScroll);
    }
  };
  scroll.addEventListener('scroll', onScroll);

  checkbox.onchange = () => {
    btn.disabled = !checkbox.checked;
  };
}

function closeWaiverGate() {
  document.getElementById('waiver-gate-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _pendingCartEvent = null;
}

function acceptWaiverGate() {
  _waiverAccepted = true;
  closeWaiverGate();
  if (_pendingCartEvent) {
    addToCart(_pendingCartEvent);
    _pendingCartEvent = null;
  }
}

function addToCart(ev) {
  _cart[ev.id] = ev;
  updateCartBar();
  // Update button state
  const btn = document.getElementById(`select-btn-${ev.id}`);
  const card = document.getElementById(`event-card-${ev.id}`);
  if (btn) {
    btn.textContent = _cart[ev.id] ? '✓ Selected' : 'Select';
    btn.classList.toggle('selected', !!_cart[ev.id]);
  }
  if (card) card.classList.toggle('selected', !!_cart[ev.id]);
}

function updateCartBar() {
  const items = Object.values(_cart);
  const bar = document.getElementById('cart-bar');
  const count = document.getElementById('cart-count');
  const total = document.getElementById('cart-total');
  if (!items.length) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const totalCents = items.reduce((s, e) => s + e.price, 0);
  count.textContent = `${items.length} session${items.length > 1 ? 's' : ''} selected`;
  total.textContent = `$${(totalCents / 100).toFixed(2)}`;
}

function openBookingFromCart() {
  const items = Object.values(_cart);
  if (!items.length) return;
  _currentEvent = items; // array for multi
  openBookingModal(items);
}

function eventCard(ev) {
  const spotsLeft = ev.capacity - ev.spotsBooked;
  const pct = (ev.spotsBooked / ev.capacity) * 100;
  const soldOut = spotsLeft <= 0;
  const urgent = !soldOut && spotsLeft <= 3;
  const priceStr = `$${(ev.price / 100).toFixed(0)}`;
  const dateStr = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const typeLabels = { individual:'Individual','small-group':'Small Group', camp:'Camp', clinic:'Clinic', team:'Team', 'ice-time':'Ice Time' };

  return `
  <div class="event-card reveal" id="event-card-${ev.id}">
    <div class="event-card-header">
      <span class="event-type-badge">${typeLabels[ev.type] || ev.type}</span>
      ${soldOut ? '<span class="event-sold-out">SOLD OUT</span>' : ''}
      ${urgent ? `<span class="event-urgent">Only ${spotsLeft} left!</span>` : ''}
    </div>
    <h3 class="event-card-title">${ev.title}</h3>
    <div class="event-card-meta">
      <span>${dateStr}</span>
      ${ev.time ? `<span>${fmt12(ev.time)}</span>` : ''}
      ${ev.location ? `<span>${ev.location}</span>` : ''}
      ${ev.duration ? `<span>${ev.duration}</span>` : ''}
    </div>
    ${ev.description ? `<p class="event-card-desc">${ev.description}</p>` : ''}
    <div class="event-card-footer">
      <div class="event-spots">
        <div class="spots-track">
          <div class="spots-fill-bar" style="width:${Math.min(pct,100)}%;background:${pct>=100?'#e74c3c':pct>=80?'#e8a020':'#3a8fd8'}"></div>
        </div>
        <span class="spots-text" style="color:${soldOut?'#e74c3c':urgent?'#e8a020':'#2ecc71'}">
          ${soldOut ? 'Sold Out' : `${spotsLeft} of ${ev.capacity} spots left`}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span class="event-price">${priceStr}</span>
        ${soldOut
          ? `<button class="btn btn-primary" disabled style="opacity:.4;cursor:not-allowed">Sold Out</button>`
          : `<button class="event-select-btn" id="select-btn-${ev.id}" onclick='toggleCart(${JSON.stringify(ev)})'>Select</button>`
        }
      </div>
    </div>
  </div>`;
}

// ── 3-Step Booking Flow ──
let _currentEvent = null; // array of events

function openBooking(ev) {
  // Single event select — add to cart and open
  _cart = { [ev.id]: ev };
  updateCartBar();
  openBookingModal([ev]);
}

function openBookingModal(events) {
  _currentEvent = events;
  const totalCents = events.reduce((s, e) => s + e.price, 0);
  const priceStr = `$${(totalCents/100).toFixed(2)}`;

  // Step 1 — list all selected sessions
  document.getElementById('booking-event-info').innerHTML = events.map(ev => {
    const dateStr = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const spotsLeft = ev.capacity - ev.spotsBooked;
    return `<div class="booking-event-summary" style="margin-bottom:10px">
      <strong>${ev.title}</strong>
      <span>${dateStr}${ev.time ? ' · ' + fmt12(ev.time) : ''}${ev.location ? ' · ' + ev.location : ''}</span>
      <span style="color:${spotsLeft<=3?'#e8a020':'#2ecc71'}">${spotsLeft} spot${spotsLeft!==1?'s':''} remaining · $${(ev.price/100).toFixed(0)}</span>
    </div>`;
  }).join('');

  document.getElementById('booking-price-row').innerHTML = `
    <div class="booking-price" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      ${events.length > 1 ? `${events.length} sessions — ` : ''}Total: <strong>${priceStr}</strong>
    </div>`;

  document.getElementById('spots-warning').textContent = '';
  document.getElementById('pay-amount').textContent = priceStr;

  goStep(1, true);
  document.getElementById('booking-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function goStep(step, init = false) {
  // Hide all panels
  [1,2,3].forEach(n => {
    document.getElementById(`bpanel-${n}`).style.display = 'none';
    const s = document.getElementById(`bstep-${n}`);
    s.classList.remove('active','done');
  });

  // Validate step 2 before moving to 3
  if (step === 3 && !init) {
    const err = document.getElementById('step2-error');
    const first = document.getElementById('book-player-first').value.trim();
    const last = document.getElementById('book-player-last').value.trim();
    const dob = document.getElementById('book-dob').value;
    const parent = document.getElementById('book-parent').value.trim();
    const phone = document.getElementById('book-phone').value.trim();
    const email = document.getElementById('book-email').value.trim();
    const relation = document.getElementById('book-relation').value;
    const emergSame = document.getElementById('emergency-same').checked;
    const emergName = document.getElementById('book-emerg-name').value.trim();
    const emergPhone = document.getElementById('book-emerg-phone').value.trim();

    if (!first || !last) { err.textContent = 'Player first and last name are required.'; return; }
    if (!dob) { err.textContent = 'Player date of birth is required.'; return; }
    if (!parent) { err.textContent = 'Parent/guardian name is required.'; return; }
    if (!phone) { err.textContent = 'Phone number is required.'; return; }
    if (!email || !email.includes('@')) { err.textContent = 'Valid email address is required.'; return; }
    if (!relation) { err.textContent = 'Please select your relationship to the player.'; return; }
    if (!emergSame && (!emergName || !emergPhone)) { err.textContent = 'Emergency contact name and phone are required.'; return; }
    err.textContent = '';

    // Build summary
    const events = Array.isArray(_currentEvent) ? _currentEvent : [_currentEvent];
    const totalCents = events.reduce((s, e) => s + e.price, 0);
    const sessionRows = events.map(ev => {
      const d = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `<div class="sum-row"><span>${ev.title}</span><span>${d}${ev.time ? ' · ' + fmt12(ev.time) : ''} — $${(ev.price/100).toFixed(0)}</span></div>`;
    }).join('');
    document.getElementById('booking-summary').innerHTML = `
      ${sessionRows}
      <div class="sum-row"><span>Player</span><span>${first} ${last}</span></div>
      <div class="sum-row"><span>Parent/Guardian</span><span>${parent} (${relation})</span></div>
      <div class="sum-row"><span>Contact</span><span>${email} · ${phone}</span></div>
      <div class="sum-row sum-total"><span>Total Due</span><span>$${(totalCents/100).toFixed(2)}</span></div>`;
  }

  // Mark done steps
  for (let n = 1; n < step; n++) {
    document.getElementById(`bstep-${n}`).classList.add('done');
    document.getElementById(`bstep-${n}`).querySelector('span').textContent = '✓';
  }

  document.getElementById(`bstep-${step}`).classList.add('active');
  document.getElementById(`bpanel-${step}`).style.display = 'block';

  // Reset error
  if (!init) document.getElementById('book-error').textContent = '';
}

function toggleEmergency(checkbox) {
  document.getElementById('emergency-fields').style.display = checkbox.checked ? 'none' : 'block';
}

function closeBooking() {
  document.getElementById('booking-overlay').classList.remove('open');
  document.body.style.overflow = '';
  _currentEvent = null;
}

async function submitBooking() {
  const btn = document.getElementById('book-submit');
  const err = document.getElementById('book-error');

  // Waiver was already accepted at session select (waiver gate)
  if (!_waiverAccepted) {
    err.textContent = 'Please go back and accept the waiver before paying.';
    return;
  }

  const playerName = `${document.getElementById('book-player-first').value.trim()} ${document.getElementById('book-player-last').value.trim()}`;
  const parentName = document.getElementById('book-parent').value.trim();
  const email = document.getElementById('book-email').value.trim();
  const phone = document.getElementById('book-phone').value.trim();
  const emergSame = document.getElementById('emergency-same').checked;

  btn.textContent = 'Processing...';
  btn.disabled = true;
  err.textContent = '';

  const events = Array.isArray(_currentEvent) ? _currentEvent : [_currentEvent];
  const totalCents = events.reduce((s, e) => s + e.price, 0);

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventIds: events.map(e => e.id),
        eventId: events[0].id, // backwards compat
        playerName,
        parentName,
        email,
        phone,
        dob: document.getElementById('book-dob').value,
        team: document.getElementById('book-team').value,
        relation: document.getElementById('book-relation').value,
        emergencyName: emergSame ? parentName : document.getElementById('book-emerg-name').value,
        emergencyPhone: emergSame ? phone : document.getElementById('book-emerg-phone').value,
        waiverAccepted: true,
        totalAmount: totalCents,
      }),
    });
    const data = await res.json();
    if (data.url) {
      // Clear cart after successful redirect
      _cart = {};
      updateCartBar();
      window.location.href = data.url;
    } else {
      err.textContent = data.error || 'Booking failed. Please try again.';
      btn.textContent = `Pay Now — $${(totalCents/100).toFixed(2)} →`;
      btn.disabled = false;
    }
  } catch {
    err.textContent = 'Network error. Please try again.';
    btn.textContent = `Pay Now — $${(totalCents/100).toFixed(2)} →`;
    btn.disabled = false;
  }
}

// Load events on page load
loadEvents();
