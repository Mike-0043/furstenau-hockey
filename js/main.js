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

function eventCard(ev) {
  const spotsLeft = ev.capacity - ev.spotsBooked;
  const pct = (ev.spotsBooked / ev.capacity) * 100;
  const soldOut = spotsLeft <= 0;
  const urgent = !soldOut && spotsLeft <= 3;
  const priceStr = `$${(ev.price / 100).toFixed(0)}`;
  const dateStr = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const typeLabels = { individual:'Individual','small-group':'Small Group', camp:'Camp', clinic:'Clinic', team:'Team', 'ice-time':'Ice Time' };

  return `
  <div class="event-card reveal">
    <div class="event-card-header">
      <span class="event-type-badge">${typeLabels[ev.type] || ev.type}</span>
      ${soldOut ? '<span class="event-sold-out">SOLD OUT</span>' : ''}
      ${urgent ? `<span class="event-urgent">Only ${spotsLeft} left!</span>` : ''}
    </div>
    <h3 class="event-card-title">${ev.title}</h3>
    <div class="event-card-meta">
      <span>${dateStr}</span>
      ${ev.time ? `<span>${ev.time}</span>` : ''}
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
        <button class="btn btn-primary" ${soldOut ? 'disabled style="opacity:.4;cursor:not-allowed"' : `onclick='openBooking(${JSON.stringify(ev)})'`}>
          ${soldOut ? 'Sold Out' : 'Book Now'}
        </button>
      </div>
    </div>
  </div>`;
}

function openBooking(ev) {
  document.getElementById('book-event-id').value = ev.id;
  const spotsLeft = ev.capacity - ev.spotsBooked;
  const dateStr = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('booking-event-info').innerHTML = `
    <div class="booking-event-summary">
      <strong>${ev.title}</strong>
      <span>${dateStr}${ev.time ? ' · ' + ev.time : ''}${ev.location ? ' · ' + ev.location : ''}</span>
      <span style="color:${spotsLeft<=3?'#e8a020':'#2ecc71'}">${spotsLeft} spot${spotsLeft!==1?'s':''} remaining</span>
    </div>`;
  document.getElementById('booking-price-row').innerHTML = `
    <div class="booking-price">Total: <strong>$${(ev.price/100).toFixed(2)}</strong></div>`;
  document.getElementById('book-error').textContent = '';
  document.getElementById('booking-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBooking() {
  document.getElementById('booking-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function submitBooking(e) {
  e.preventDefault();
  const btn = document.getElementById('book-submit');
  const err = document.getElementById('book-error');

  // Validate waiver checkbox
  if (!document.getElementById('waiver-agree').checked) {
    err.textContent = 'You must read and agree to the Participation Agreement before booking.';
    return;
  }

  btn.textContent = 'Redirecting to payment...';
  btn.disabled = true;
  err.textContent = '';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId:    document.getElementById('book-event-id').value,
        playerName: document.getElementById('book-player').value,
        parentName: document.getElementById('book-parent').value,
        email:      document.getElementById('book-email').value,
        phone:      document.getElementById('book-phone').value,
        waiverAccepted: true,
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      err.textContent = data.error || 'Booking failed. Please try again.';
      btn.textContent = 'Proceed to Payment →';
      btn.disabled = false;
    }
  } catch {
    err.textContent = 'Network error. Please try again.';
    btn.textContent = 'Proceed to Payment →';
    btn.disabled = false;
  }
}

// Load events on page load
loadEvents();
