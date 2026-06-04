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
function submitForm(e) {
  e.preventDefault();
  const note = document.getElementById('form-note');
  const btn = e.target.querySelector('button[type="submit"]');
  note.textContent = '';
  btn.textContent = 'Sending...';
  btn.disabled = true;

  setTimeout(() => {
    note.textContent = '✓ Message sent! Craig will be in touch soon.';
    btn.textContent = 'Send Message';
    btn.disabled = false;
    e.target.reset();
  }, 900);
}
