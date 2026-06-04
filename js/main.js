// ── Mobile nav toggle ──
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

toggle?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});

// Close nav on link click (mobile)
navLinks?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Clip switcher ──
const iframe = document.querySelector('.video-wrap iframe');
const clipTitle = document.querySelector('.clip-meta h3');
const clipDesc = document.querySelector('.clip-meta p');
const clipItems = document.querySelectorAll('.clip-item');

clipItems.forEach(item => {
  item.addEventListener('click', () => {
    clipItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const id = item.dataset.id;
    const title = item.dataset.title;
    const desc = item.dataset.desc;

    if (iframe) iframe.src = `https://www.youtube.com/embed/${id}`;
    if (clipTitle) clipTitle.textContent = title;
    if (clipDesc) clipDesc.textContent = desc;
  });
});

// ── Copy link ──
function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

// ── Contact form ──
function submitForm(e) {
  e.preventDefault();
  const note = document.getElementById('form-note');
  note.textContent = "Thanks! Craig will be in touch soon.";
  e.target.reset();
}

// ── Active nav on scroll ──
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.classList.toggle('active-nav', a.getAttribute('href') === `#${entry.target.id}`);
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => observer.observe(s));
