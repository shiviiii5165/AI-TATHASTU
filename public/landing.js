
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Tracks whether an element is on (or near) screen, so continuous animations
   skip their per-frame drawing and layout reads while it's scrolled away.
   (rAF itself already pauses in hidden tabs.) */
function trackOnScreen(el) {
  const state = { visible: true };
  if (!el || !('IntersectionObserver' in window)) return state;
  new IntersectionObserver((entries) => {
    state.visible = entries[entries.length - 1].isIntersecting;
  }, { rootMargin: '150px 0px' }).observe(el);
  return state;
}

/* Runs a scroll handler at most once per animation frame instead of on every
   scroll event (handlers here read layout, then write styles). */
function onScrollFrame(fn) {
  let queued = false;
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  }, { passive: true });
}

/* ============================================================
   1. SUBTLE WEB AUDIO SYNTHESIZER
============================================================ */
class TactileAudio {
  constructor() {
    this.enabled = false;
    this.ctx = null;
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.enabled && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.enabled) this.chime(523.25, 0.12, 'sine');
    return this.enabled;
  }
  chime(freq = 440, dur = 0.14, type = 'sine', vol = 0.05) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (e) {}
  }
  chord(freqs = [440, 554.37, 659.25]) {
    freqs.forEach((f, i) => setTimeout(() => this.chime(f, 0.25, 'triangle', 0.045), i * 55));
  }
}
const sfx = new TactileAudio();

const soundToggle = document.getElementById('soundToggle');
if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    const on = sfx.toggle();
    soundToggle.classList.toggle('active', on);
    const soundIcon = document.getElementById('soundIcon');
    if (soundIcon) soundIcon.textContent = on ? '🔊' : '🔇';
    const soundLabel = document.getElementById('soundLabel');
    if (soundLabel) soundLabel.textContent = on ? 'Sound On' : 'Sound Off';
    if (typeof showToast === 'function') showToast(on ? '🔊 Subtle sound effects enabled' : '🔇 Sound muted');
  });
}

/* ============================================================
   3. EXACT REFERENCE ECOSYSTEM CONNECTOR PATHS (SVG BEZIER)
============================================================ */
function initReferenceEcoConnections() {
  const stage = document.getElementById('refEcoStage');
  const svgGroup = document.getElementById('refSvgConnectionsGroup');
  const centralCard = document.getElementById('refCentralCard');
  const sourceCards = Array.from(document.querySelectorAll('#refSourceCol .ref-source-card'));
  const destCards = Array.from(document.querySelectorAll('#refDestCol .ref-dest-card'));

  if (!stage || !svgGroup || !centralCard || !sourceCards.length) return;

  function updateSvgPaths() {
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;

    if (window.innerWidth <= 1080 || stageRect.width < 780) {
      svgGroup.innerHTML = "";
      return;
    }

    const cardRect = centralCard.getBoundingClientRect();
    const cardLeftX = cardRect.left - stageRect.left;
    const cardRightX = cardRect.right - stageRect.left;
    const cardCenterY = cardRect.top - stageRect.top + cardRect.height / 2;

    let pathsHtml = '';

    // 1. Connect 7 Left Source Cards -> Central Profile Card
    const sourceCount = sourceCards.length;
    sourceCards.forEach((card, idx) => {
      const cRect = card.getBoundingClientRect();
      const startX = cRect.right - stageRect.left;
      const startY = cRect.top - stageRect.top + cRect.height / 2;

      // Vertical distribution along left edge of profile card
      const offsetNorm = (idx - (sourceCount - 1) / 2) * 18;
      const endX = cardLeftX;
      const endY = cardCenterY + offsetNorm;

      const spanX = Math.max(30, endX - startX);
      const cp1X = startX + spanX * 0.52;
      const cp1Y = startY;
      const cp2X = endX - spanX * 0.45;
      const cp2Y = endY;

      const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      const color = card.getAttribute('data-accent') || '#8B5CF6';

      // Outer glow path
      pathsHtml += `<path d="${d}" stroke="${color}" stroke-width="4" stroke-opacity="0.18" fill="none" filter="url(#ecoGlow)"/>`;
      // Main clean guide wire
      pathsHtml += `<path d="${d}" stroke="${color}" stroke-width="2" stroke-opacity="0.55" fill="none" />`;
      // Start node
      pathsHtml += `<circle cx="${startX}" cy="${startY}" r="3.5" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>`;
      // End node on card
      pathsHtml += `<circle cx="${endX}" cy="${endY}" r="3" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>`;

      // Animated traveling pulse particle
      if (!RM) {
        pathsHtml += `
          <circle r="3.5" fill="${color}">
            <animateMotion path="${d}" dur="${2.4 + idx * 0.15}s" repeatCount="indefinite" begin="${idx * 0.32}s"/>
          </circle>
          <circle r="6" fill="${color}" opacity="0.3">
            <animateMotion path="${d}" dur="${2.4 + idx * 0.15}s" repeatCount="indefinite" begin="${idx * 0.32}s"/>
          </circle>
        `;
      }
    });

    // 2. Connect Central Profile Card -> 3 Right Ecosystem Cards
    const destCount = destCards.length;
    destCards.forEach((card, idx) => {
      const cRect = card.getBoundingClientRect();
      const endX = cRect.left - stageRect.left;
      const endY = cRect.top - stageRect.top + cRect.height / 2;

      const offsetNorm = (idx - (destCount - 1) / 2) * 32;
      const startX = cardRightX;
      const startY = cardCenterY + offsetNorm;

      const spanX = Math.max(30, endX - startX);
      const cp1X = startX + spanX * 0.45;
      const cp1Y = startY;
      const cp2X = endX - spanX * 0.52;
      const cp2Y = endY;

      const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      const color = card.getAttribute('data-accent') || '#F59E0B';

      pathsHtml += `<path d="${d}" stroke="${color}" stroke-width="4.5" stroke-opacity="0.18" fill="none" filter="url(#ecoGlow)"/>`;
      pathsHtml += `<path d="${d}" stroke="${color}" stroke-width="2.2" stroke-opacity="0.6" fill="none" />`;
      pathsHtml += `<circle cx="${startX}" cy="${startY}" r="3.5" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>`;
      pathsHtml += `<circle cx="${endX}" cy="${endY}" r="3" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>`;

      if (!RM) {
        pathsHtml += `
          <circle r="4" fill="${color}">
            <animateMotion path="${d}" dur="${2.6 + idx * 0.2}s" repeatCount="indefinite" begin="${idx * 0.4}s"/>
          </circle>
          <circle r="7" fill="${color}" opacity="0.3">
            <animateMotion path="${d}" dur="${2.6 + idx * 0.2}s" repeatCount="indefinite" begin="${idx * 0.4}s"/>
          </circle>
        `;
      }
    });

    svgGroup.innerHTML = pathsHtml;
  }

  // Interactive card audio and feedback
  [...sourceCards, ...destCards].forEach(card => {
    card.addEventListener('pointerenter', () => {
      if (typeof sfx !== 'undefined' && sfx.chime) {
        sfx.chime(580, 0.08, 'sine');
      }
    });
    card.addEventListener('click', () => {
      if (typeof sfx !== 'undefined' && sfx.chime) {
        sfx.chime(720, 0.12, 'triangle');
      }
    });
  });

  if (centralCard) {
    centralCard.addEventListener('pointerenter', () => {
      if (typeof sfx !== 'undefined' && sfx.chime) {
        sfx.chime(659.25, 0.1, 'sine');
      }
    });
  }

  window.addEventListener('resize', updateSvgPaths);
  if ('ResizeObserver' in window) new ResizeObserver(updateSvgPaths).observe(stage);
  setTimeout(updateSvgPaths, 60);
  setTimeout(updateSvgPaths, 300);
}
initReferenceEcoConnections();

/* ============================================================
   4. ETHEREAL FLOWING SPECTRAL MESH WAVES (HARMONIC CURVES)
============================================================ */
function initReferenceMeshWaves() {
  const cv = document.getElementById('refMeshCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let time = 0;

  function resize() {
    W = cv.clientWidth || window.innerWidth;
    H = cv.clientHeight || 360;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Color stops for the spectral mesh ribbons
  const ribbons = [
    { baseAlpha: 0.38, speed: 0.007, freq: 0.003, amp: 48, yOffset: 0.65, color1: '#FF6B4A', color2: '#FF2A85' },
    { baseAlpha: 0.34, speed: 0.009, freq: 0.004, amp: 38, yOffset: 0.72, color1: '#FF2A85', color2: '#8B5CF6' },
    { baseAlpha: 0.30, speed: 0.006, freq: 0.0028, amp: 54, yOffset: 0.80, color1: '#8B5CF6', color2: '#38BDF8' },
    { baseAlpha: 0.26, speed: 0.008, freq: 0.0035, amp: 42, yOffset: 0.88, color1: '#38BDF8', color2: '#10B981' },
    { baseAlpha: 0.22, speed: 0.005, freq: 0.0024, amp: 50, yOffset: 0.78, color1: '#F59E0B', color2: '#FF3366' }
  ];

  const onScreen = trackOnScreen(cv);

  function drawWaves() {
    if (!onScreen.visible && !RM) {
      requestAnimationFrame(drawWaves); // idle until it scrolls back into view
      return;
    }
    if (!RM) time += 1;
    ctx.clearRect(0, 0, W, H);

    ribbons.forEach((r, idx) => {
      ctx.beginPath();
      const centerY = H * r.yOffset;
      const grad = ctx.createLinearGradient(0, centerY, W, centerY);
      grad.addColorStop(0, r.color1);
      grad.addColorStop(1, r.color2);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = r.baseAlpha;

      for (let x = 0; x <= W; x += 6) {
        const y = centerY + Math.sin(x * r.freq + time * r.speed + idx) * r.amp + Math.cos(x * r.freq * 0.5 + time * r.speed * 0.8) * (r.amp * 0.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
    if (!RM) requestAnimationFrame(drawWaves);
  }

  drawWaves();
}
initReferenceMeshWaves();

/* ============================================================
   TRUSTED INSTITUTION STRIP CAROUSEL & AUTO-SCROLL
============================================================ */
function initReferenceStripCarousel() {
  const track = document.getElementById('refStripTrack');
  const prevBtn = document.getElementById('stripPrevBtn');
  const nextBtn = document.getElementById('stripNextBtn');

  if (!track) return;

  // Clone items twice to create an infinite seamless loop
  const originalItems = Array.from(track.children);
  for (let pass = 0; pass < 2; pass++) {
    originalItems.forEach(item => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }

  let isHovered = false;
  let isTouching = false;
  const speed = 0.85;

  track.addEventListener('pointerenter', () => { isHovered = true; });
  track.addEventListener('pointerleave', () => { isHovered = false; });
  track.addEventListener('touchstart', () => { isTouching = true; }, { passive: true });
  track.addEventListener('touchend', () => { isTouching = false; }, { passive: true });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      track.scrollBy({ left: -260, behavior: 'smooth' });
      if (typeof sfx !== 'undefined' && sfx.tick) sfx.tick(800);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      track.scrollBy({ left: 260, behavior: 'smooth' });
      if (typeof sfx !== 'undefined' && sfx.tick) sfx.tick(900);
    });
  }

  const onScreen = trackOnScreen(track);

  function autoScroll() {
    if (onScreen.visible && !isHovered && !isTouching && !RM) {
      track.scrollLeft += speed;
      const singleSetWidth = track.scrollWidth / 3;
      if (track.scrollLeft >= singleSetWidth * 2) {
        track.scrollLeft -= singleSetWidth;
      } else if (track.scrollLeft <= 0) {
        track.scrollLeft += singleSetWidth;
      }
    }
    requestAnimationFrame(autoScroll);
  }
  requestAnimationFrame(autoScroll);
}
initReferenceStripCarousel();

/* Centralized Dark Mode & Theme Controller */
const themeToggleBtn = document.getElementById('refThemeToggleBtn');
const SUN_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B69CFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function updateLandingThemeUI(isDark) {
  if (!themeToggleBtn) return;
  themeToggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggleBtn.innerHTML = isDark ? MOON_SVG : SUN_SVG;
}

if (themeToggleBtn) {
  // Initialize UI based on current DOM state (set by head script)
  const isInitialDark = document.documentElement.classList.contains('dark');
  updateLandingThemeUI(isInitialDark);

  themeToggleBtn.addEventListener('click', () => {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    const nextDark = !isCurrentlyDark;
    const nextTheme = nextDark ? 'dark' : 'light';

    try {
      localStorage.setItem('ai-tathastu-theme', nextTheme);
    } catch (e) {}

    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
    }

    updateLandingThemeUI(nextDark);

    // Notify React ThemeProvider and other modules
    window.dispatchEvent(
      new CustomEvent('ai-tathastu-theme-change', {
        detail: { theme: nextTheme, resolvedTheme: nextTheme },
      })
    );

    if (typeof showToast === 'function') {
      showToast(nextDark ? '🌙 Dark mode enabled' : '☀️ Light mode restored');
    }
  });

  // Listen for theme changes from React components or other tabs
  window.addEventListener('ai-tathastu-theme-change', (e) => {
    const detail = e.detail;
    if (detail) {
      const isDark = detail.resolvedTheme === 'dark' || detail.theme === 'dark';
      updateLandingThemeUI(isDark);
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'ai-tathastu-theme') {
      const isDark = e.newValue === 'dark' || (e.newValue === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      updateLandingThemeUI(isDark);
    }
  });
}
const seeHowBtn = document.getElementById('seeHowItWorksBtn');
if (seeHowBtn) {
  seeHowBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof sfx !== 'undefined' && sfx.chime) sfx.chime(493.88, 0.1, 'sine');
    const ecoEl = document.getElementById('ecosystem') || document.getElementById('how');
    if (ecoEl) ecoEl.scrollIntoView({ behavior: 'smooth' });
  });
}

/* Mobile Navigation Drawer Controller */
const mobMenuBtn = document.getElementById('refMobileMenuBtn');
const mobDrawer = document.getElementById('refMobileDrawer');
if (mobMenuBtn && mobDrawer) {
  const toggleMobDrawer = (force) => {
    const isNowOpen = force !== undefined ? force : !mobDrawer.classList.contains('is-open');
    mobDrawer.classList.toggle('is-open', isNowOpen);
    mobDrawer.setAttribute('aria-hidden', (!isNowOpen).toString());
    mobMenuBtn.classList.toggle('is-active', isNowOpen);
    mobMenuBtn.setAttribute('aria-expanded', isNowOpen.toString());
  };

  mobMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobDrawer();
  });

  mobDrawer.querySelectorAll('.ref-mobile-nav-item').forEach((link) => {
    link.addEventListener('click', () => toggleMobDrawer(false));
  });

  document.addEventListener('click', (e) => {
    if (!mobDrawer.contains(e.target) && !mobMenuBtn.contains(e.target)) {
      toggleMobDrawer(false);
    }
  });

  const mobThemeBtn = document.getElementById('refMobileThemeBtn');
  if (mobThemeBtn) {
    mobThemeBtn.addEventListener('click', () => {
      const themeBtn = document.getElementById('refThemeToggleBtn');
      if (themeBtn) themeBtn.click();
    });
  }
}




/* ============================================================
   8. HOW ONE PROJECT CONNECTS EVERYTHING (FLOW VISUALIZER)
============================================================ */
const attCv = document.getElementById('attentionCanvas');
const attCtx = attCv ? attCv.getContext('2d') : null;
const attTokens = document.querySelectorAll('.att-token');
let activeTokenIdx = 0;
let attAnimPhase = 0;

const ATT_WEIGHTS = [
  [1.0, 0.75, 0.70, 0.95, 0.92, 0.85, 0.88],
  [0.72, 1.0, 0.68, 0.90, 0.88, 0.80, 0.94],
  [0.75, 0.68, 1.0, 0.88, 0.84, 0.98, 0.90],
  [0.95, 0.90, 0.88, 1.0, 0.96, 0.92, 0.94],
  [0.92, 0.86, 0.82, 0.96, 1.0, 0.78, 0.84],
  [0.84, 0.80, 0.98, 0.92, 0.78, 1.0, 0.88],
  [0.88, 0.94, 0.90, 0.94, 0.84, 0.88, 1.0]
];
const ATT_COLORS = ['#EAB308', '#8B5CF6', '#FF5A5F', '#22C55E', '#F43F5E', '#CA8A04', '#DB2777'];

attTokens.forEach((btn, idx) => {
  const activate = () => {
    attTokens.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTokenIdx = idx;
    sfx.chime(440 + idx * 55, 0.1, 'sine');
  };
  btn.addEventListener('pointerenter', activate);
  btn.addEventListener('click', activate);
});

const attOnScreen = trackOnScreen(attCv);

(function drawAttentionLoop() {
  requestAnimationFrame(drawAttentionLoop);
  // Off-screen: skip the per-frame getBoundingClientRect reads and redraw.
  if (!attOnScreen.visible) return;
  if (!attCtx || !attCv || !attCv.parentElement) return;
  const r = attCv.getBoundingClientRect();
  if (!r.width) return;
  if (attCv.width !== Math.round(r.width * 2)) {
    attCv.width = Math.round(r.width * 2);
    attCv.height = Math.round(r.height * 2);
  }
  attCtx.setTransform(2, 0, 0, 2, 0, 0);
  const W = r.width, H = r.height;
  attCtx.clearRect(0, 0, W, H);
  attAnimPhase += 0.045;

  const parentRect = attCv.parentElement.getBoundingClientRect();
  const centers = Array.from(attTokens).map(t => {
    const tr = t.getBoundingClientRect();
    return (tr.left - parentRect.left) + tr.width / 2 - 30;
  });

  const srcX = centers[activeTokenIdx] || W / 2;
  const weights = ATT_WEIGHTS[activeTokenIdx] || ATT_WEIGHTS[0];

  centers.forEach((dstX, j) => {
    const w = weights[j] || 0.5;
    const midX = (srcX + dstX) / 2;
    const archH = Math.min(H - 8, 18 + Math.abs(dstX - srcX) * 0.12);

    attCtx.beginPath();
    attCtx.moveTo(srcX, 4);
    attCtx.quadraticCurveTo(midX, archH, dstX, 4);
    attCtx.strokeStyle = ATT_COLORS[j % ATT_COLORS.length];
    attCtx.globalAlpha = w * 0.72;
    attCtx.lineWidth = 1.2 + w * 3.8;
    attCtx.stroke();

    const t = (attAnimPhase * 0.35 + j * 0.14) % 1;
    const px = (1 - t) * (1 - t) * srcX + 2 * (1 - t) * t * midX + t * t * dstX;
    const py = (1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * archH + t * t * 4;
    attCtx.beginPath();
    attCtx.arc(px, py, 3.2 * w, 0, Math.PI * 2);
    attCtx.fillStyle = ATT_COLORS[j % ATT_COLORS.length];
    attCtx.globalAlpha = 0.95;
    attCtx.fill();
  });
  attCtx.globalAlpha = 1;
})();

/* ============================================================
   10. 3D PERSPECTIVE TILT CARDS & INTERACTIVE ROOM MODAL
============================================================ */
function bind3DTilt(selector, maxDeg = 7) {
  document.querySelectorAll(selector).forEach(card => {
    card.addEventListener('pointermove', (e) => {
      if (RM) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * maxDeg * 2;
      const ry = (px - 0.5) * maxDeg * 2;
      card.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-5px)`;
      card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      card.style.setProperty('--hx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--hy', `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}
bind3DTilt('.bento-card', 7);
bind3DTilt('#holoCard', 10);

const ROOM_DETAILS = {
  avasar: {
    icon: '⚡',
    title: 'Avasar (Get Hired)',
    edge: '#CA8A04',
    desc: 'Connect your verified skills directly to internships, research labs, and hiring pipelines without resume black holes.',
    features: [
      'Proof-based matching algorithm powered by your actual repository code and project artifacts.',
      'Direct invitations from campus recruiters and tech labs actively seeking your verified skills.',
      'Transparent opportunity requirements with zero keyword-stuffing barriers.',
      'Development status: In active testing across select partner departments.'
    ]
  },
  learn: {
    icon: '📚',
    title: 'Learn (Grow)',
    edge: '#E11D48',
    desc: 'Skip repetitive tutorials. Get custom learning paths tailored to your knowledge gaps based on the code you have already shipped.',
    features: [
      'Automated prerequisite detection that respects your existing project mastery.',
      'Targeted milestone roadmaps for advanced AI, systems, and full-stack development.',
      'Curated real-world project specifications that build production-ready portfolios.',
      'Development status: Module preview releasing in upcoming beta milestone.'
    ]
  },
  collaborate: {
    icon: '👥',
    title: 'Collaborate (Build)',
    edge: '#16A34A',
    desc: 'Find compatible co-builders for hackathons, capstones, and open-source projects based on complementary skill graphs.',
    features: [
      'Complementary team matching (e.g., ML engineer + frontend designer + systems engineer).',
      'Shared project workspace creation with role-based contribution tracking.',
      'Campus-wide and inter-collegiate hackathon squad discovery.',
      'Development status: Architecture finalized; campus pilot launching soon.'
    ]
  },
  meet: {
    icon: '💬',
    title: 'Meet (Get Guidance)',
    edge: '#7C3AED',
    desc: 'Join focused virtual co-working rooms and connect with verified alumni mentors for targeted 15-minute guidance.',
    features: [
      'Drop-in virtual rooms for focused silent study and live technical co-building.',
      '15-minute micro-mentorship sessions to resolve architectural roadblocks.',
      'Alumni insights and technical interview preparation with industry practitioners.',
      'Development status: Schedule and mentor roster currently being onboarded.'
    ]
  },
  iris: {
    icon: '🎯',
    title: 'IRIS (ASSESS)',
    edge: '#DB2777',
    desc: 'An objective, stress-free capability assessment that evaluates real problem-solving and code architecture rather than memorization.',
    features: [
      'Real-world debugging scenarios and code review challenges.',
      'Zero invasive proctoring or stress-inducing camera surveillance.',
      'Comprehensive readiness scores verifying structural thinking and code quality.',
      'Development status: IRIS core assessment engine in private preview.'
    ]
  }
};

const POLICY_DETAILS = {
  privacy: {
    eyebrow: 'Your Privacy First',
    title: 'Privacy Promise',
    edge: '#16A34A',
    desc: 'We never touch private code without permission, never sell student data, and never use invasive surveillance.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Public &amp; approved projects only · ✓ Delete your profile anytime with one click</div>`
  },
  terms: {
    eyebrow: 'Simple & Fair Terms',
    title: 'Terms of Use',
    edge: '#F43F5E',
    desc: 'Everything you build belongs 100% to you. AI Tathastu simply helps you showcase your verified proof to the world.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ You own your IP · ✓ Nothing is shared publicly until you approve it</div>`
  },
  ownership: {
    eyebrow: 'You Stay in Control',
    title: '100% Data Ownership',
    edge: '#7C3AED',
    desc: 'You have the final say on every single line of your profile. Edit, hide, or remove any item whenever you want.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Line-by-line approval · ✓ Export your profile data anytime</div>`
  },
  cookies: {
    eyebrow: 'Transparent Cookie Policy',
    title: 'Cookie & Tracking Policy',
    edge: '#38BDF8',
    desc: 'We only use strictly essential cookies to maintain your session and preferences. Zero third-party ad tracking.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Essential cookies only · ✓ Zero ad trackers · ✓ Respects Do-Not-Track headers</div>`
  },
  about: {
    eyebrow: 'Our Story',
    title: 'About AI Tathastu',
    edge: '#8B5CF6',
    desc: 'Built by engineers and campus leaders to eliminate the resume black hole and verify student work with cryptographic proof.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Empowering 500+ campuses · ✓ Verified digital portfolios for every student</div>`
  },
  mission: {
    eyebrow: 'Our Vision',
    title: 'Democratizing Opportunity',
    edge: '#F43F5E',
    desc: 'We believe your proof of work speaks louder than pedigree. Every verified model, paper, and hackathon project matters.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Merit-first matchmaking · ✓ Direct access to research squads and top labs</div>`
  },
  team: {
    eyebrow: 'Behind The Platform',
    title: 'Meet the Builders',
    edge: '#F59E0B',
    desc: 'A multidisciplinary team of AI researchers, designers, and systems architects passionate about student empowerment.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Founded by campus alumni · ✓ Open research collaborations</div>`
  },
  careers: {
    eyebrow: 'Join Our Mission',
    title: 'Careers at AI Tathastu',
    edge: '#10B981',
    desc: 'We are growing our core team across Distributed Systems, Machine Learning, and Visual Design. Build the future of campus talent.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ Remote-friendly · ✓ High impact on campus ecosystems · ✓ Competitive equity</div>`
  },
  contact: {
    eyebrow: 'Get In Touch',
    title: 'Contact AI Tathastu',
    edge: '#6366F1',
    desc: 'Have a question or want to onboard your campus? Reach out to our campus liaison team anytime at team@aitathastu.com.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ 24-hour response time · ✓ Dedicated campus onboarding support</div>`
  },
  press: {
    eyebrow: 'Media & Brand',
    title: 'Press & Media Kit',
    edge: '#EC4899',
    desc: 'Download official brand logos, screenshots, press releases, and founder bios for articles and conference materials.',
    simHTML: `<div style="font-size:.9rem;color:var(--ink-soft)">✓ High-res vector logos · ✓ Brand color guidelines · ✓ Press statements</div>`
  }
};


let lastActiveModalTrigger = null;

function openModal(data) {
  if (!data) return;
  const roomModal = document.getElementById('roomModal');
  const modalCard = document.getElementById('modalCard');
  if (!roomModal) return;

  lastActiveModalTrigger = document.activeElement;

  if (modalCard && data.edge) {
    modalCard.style.setProperty('--modal-edge', data.edge);
  }
  const iconWrap = document.getElementById('modalIconWrap');
  if (iconWrap) iconWrap.textContent = data.icon || '✦';

  const eyebrowEl = document.getElementById('modalEyebrow');
  if (eyebrowEl && data.eyebrow) eyebrowEl.innerHTML = '<b>✦</b> ' + data.eyebrow;

  const titleEl = document.getElementById('modalTitle');
  if (titleEl) titleEl.textContent = data.title;

  const descEl = document.getElementById('modalDesc');
  if (descEl) descEl.textContent = data.desc;

  const boxEl = document.getElementById('modalSimBox');
  if (boxEl) {
    if (data.features && Array.isArray(data.features)) {
      boxEl.innerHTML = data.features.map(f => `
        <div class="modal-feature-bullet">
          <span class="bullet-icon">✓</span>
          <span>${f}</span>
        </div>
      `).join('');
    } else if (data.simHTML) {
      boxEl.innerHTML = data.simHTML;
    }
  }

  roomModal.classList.add('open');
  const closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) closeBtn.focus();
  sfx.chime(587.33, 0.16, 'triangle');
}

function closeModal() {
  const roomModal = document.getElementById('roomModal');
  if (roomModal) roomModal.classList.remove('open');
  if (lastActiveModalTrigger && typeof lastActiveModalTrigger.focus === 'function') {
    lastActiveModalTrigger.focus();
  }
}

function openDemoModal() {
  const demoModal = document.getElementById('demoModal');
  if (!demoModal) return;
  lastActiveModalTrigger = document.activeElement;
  demoModal.classList.add('open');
  const closeBtn = document.getElementById('demoModalCloseBtn');
  if (closeBtn) closeBtn.focus();
  sfx.chime(587.33, 0.16, 'triangle');
}

function closeDemoModal() {
  const demoModal = document.getElementById('demoModal');
  if (demoModal) demoModal.classList.remove('open');
  if (lastActiveModalTrigger && typeof lastActiveModalTrigger.focus === 'function') {
    lastActiveModalTrigger.focus();
  }
}

function initLandingModals() {
  const roomModal = document.getElementById('roomModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalActionBtn = document.getElementById('modalActionBtn');

  document.querySelectorAll('.bento-card[data-room]').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.getAttribute('data-room');
      openModal(ROOM_DETAILS[key]);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const key = card.getAttribute('data-room');
        openModal(ROOM_DETAILS[key]);
      }
    });
  });

  document.querySelectorAll('[data-policy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-policy');
      openModal(POLICY_DETAILS[key]);
    });
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (roomModal) {
    roomModal.addEventListener('click', (e) => {
      if (e.target === roomModal) closeModal();
    });
  }
  if (modalActionBtn) {
    modalActionBtn.addEventListener('click', () => {
      sfx.chord([523.25, 659.25, 783.99]);
      closeModal();
    });
  }

  // Demo Modal bindings
  const demoModal = document.getElementById('demoModal');
  const demoModalCloseBtn = document.getElementById('demoModalCloseBtn');
  const demoModalActionBtn = document.getElementById('demoModalActionBtn');
  const watchDemoBtn = document.getElementById('watchDemoBtn');
  const demoPlayTrigger = document.getElementById('demoPlayTrigger');

  if (watchDemoBtn) watchDemoBtn.addEventListener('click', openDemoModal);
  if (demoPlayTrigger) demoPlayTrigger.addEventListener('click', openDemoModal);
  if (demoModalCloseBtn) demoModalCloseBtn.addEventListener('click', closeDemoModal);
  if (demoModalActionBtn) {
    demoModalActionBtn.addEventListener('click', () => {
      sfx.chord([523.25, 659.25, 783.99]);
      closeDemoModal();
    });
  }
  if (demoModal) {
    demoModal.addEventListener('click', (e) => {
      if (e.target === demoModal) closeDemoModal();
    });
  }

  // Keyboard accessibility
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (roomModal && roomModal.classList.contains('open')) closeModal();
      if (demoModal && demoModal.classList.contains('open')) closeDemoModal();
    }
  });
}
initLandingModals();

function initFaqAccordion() {
  const triggers = document.querySelectorAll('.faq-trigger');
  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      if (!item) return;
      const isOpen = item.classList.contains('open');

      document.querySelectorAll('.faq-item.open').forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          const otherTrigger = other.querySelector('.faq-trigger');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        item.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        sfx.chime(520, 0.08, 'sine', 0.02);
      }
    });
  });
}
initFaqAccordion();

/* ============================================================
   11. INTERACTIVE SKILL NODE CONSTELLATION GRAPH PLAYGROUND
============================================================ */
class SkillConstellationGraph {
  constructor(canvas) {
    if (!canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.time = 0;
    this.visible = true;
    this.dragNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.ripples = [];
    this.plantIdx = 0;

    this.extraSkills = [
      { label: ['Computer', 'Vision'], gradient: ['#EC4899', '#F43F5E'], glow: 'rgba(236, 72, 153, 0.65)', icon: 'neural' },
      { label: ['AI', 'Agents'], gradient: ['#8B5CF6', '#A855F7'], glow: 'rgba(139, 92, 246, 0.65)', icon: 'brain' },
      { label: ['Transformers'], gradient: ['#0284C7', '#38BDF8'], glow: 'rgba(14, 165, 233, 0.65)', icon: 'scatter' },
      { label: ['PyTorch'], gradient: ['#F97316', '#FB923C'], glow: 'rgba(249, 115, 22, 0.65)', icon: 'python' },
      { label: ['LangChain'], gradient: ['#10B981', '#34D399'], glow: 'rgba(16, 185, 129, 0.65)', icon: 'chat_doc' },
      { label: ['Kaggle', 'Master'], gradient: ['#0EA5E9', '#6366F1'], glow: 'rgba(14, 165, 233, 0.65)', icon: 'certificate' }
    ];

    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(() => this.resize()).observe(this.canvas);
    new IntersectionObserver(es => es.forEach(e => this.visible = e.isIntersecting), { threshold: 0 }).observe(this.canvas);

    this.initConstellation();
    this.bindEvents();
    this.loop();
  }

  updateScale() {
    const baseW = 720;
    this.scale = Math.min(1.0, Math.max(0.52, (this.W || 720) / baseW));
    this.isMobile = (this.W || 720) < 540;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const prevW = this.W, prevH = this.H;
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.updateScale();

    if (this.nodes && this.nodes.length) {
      this.nodes.forEach(n => {
        n.r = Math.round((n.baseR || 33) * this.scale);
      });
      if (prevW && prevH) {
        const sx = this.W / prevW, sy = this.H / prevH;
        this.nodes.forEach(n => {
          n.x *= sx; n.y *= sy;
          n.originX *= sx; n.originY *= sy;
        });
      }
    }
  }

  initConstellation() {
    const W = this.W || 720, H = this.H || 480;
    this.updateScale();

    // Responsive node layout: On mobile (<540px), distribute outer nodes symmetrically around center to eliminate overlap
    const coords = this.isMobile ? [
      { id: 'ml', nx: 0.50, ny: 0.50 },
      { id: 'python', nx: 0.38, ny: 0.16 },
      { id: 'research', nx: 0.62, ny: 0.16 },
      { id: 'deep_learning', nx: 0.83, ny: 0.28 },
      { id: 'nlp', nx: 0.88, ny: 0.50 },
      { id: 'evidence', nx: 0.83, ny: 0.72 },
      { id: 'mlops', nx: 0.63, ny: 0.84 },
      { id: 'ds', nx: 0.44, ny: 0.85 },
      { id: 'math', nx: 0.24, ny: 0.75 },
      { id: 'comm', nx: 0.15, ny: 0.50 },
      { id: 'ds_science', nx: 0.21, ny: 0.28 }
    ] : [
      { id: 'ml', nx: 0.50, ny: 0.50 },
      { id: 'python', nx: 0.40, ny: 0.22 },
      { id: 'research', nx: 0.61, ny: 0.17 },
      { id: 'deep_learning', nx: 0.81, ny: 0.24 },
      { id: 'nlp', nx: 0.90, ny: 0.44 },
      { id: 'evidence', nx: 0.88, ny: 0.66 },
      { id: 'mlops', nx: 0.76, ny: 0.80 },
      { id: 'ds', nx: 0.57, ny: 0.83 },
      { id: 'math', nx: 0.40, ny: 0.73 },
      { id: 'comm', nx: 0.25, ny: 0.59 },
      { id: 'ds_science', nx: 0.26, ny: 0.37 }
    ];

    const getCoord = (id) => coords.find(c => c.id === id) || { nx: 0.5, ny: 0.5 };

    // Exact 11 nodes with scalable base radii and calibrated non-colliding positions
    this.nodes = [
      {
        id: 'ml',
        label: ['Machine', 'Learning'],
        nx: getCoord('ml').nx, ny: getCoord('ml').ny,
        baseR: 48,
        r: Math.round(48 * this.scale),
        isCenter: true,
        gradient: ['#6B21A8', '#EC4899'],
        glow: 'rgba(236, 72, 153, 0.70)',
        icon: 'brain'
      },
      {
        id: 'python',
        label: ['Python'],
        nx: getCoord('python').nx, ny: getCoord('python').ny,
        baseR: 32,
        r: Math.round(32 * this.scale),
        gradient: ['#F59E0B', '#F97316'],
        glow: 'rgba(245, 158, 11, 0.58)',
        icon: 'python'
      },
      {
        id: 'research',
        label: ['Research'],
        nx: getCoord('research').nx, ny: getCoord('research').ny,
        baseR: 32,
        r: Math.round(32 * this.scale),
        gradient: ['#EC4899', '#F43F5E'],
        glow: 'rgba(236, 72, 153, 0.58)',
        icon: 'document'
      },
      {
        id: 'deep_learning',
        label: ['Deep', 'Learning'],
        nx: getCoord('deep_learning').nx, ny: getCoord('deep_learning').ny,
        baseR: 34,
        r: Math.round(34 * this.scale),
        gradient: ['#7C3AED', '#8B5CF6'],
        glow: 'rgba(124, 58, 237, 0.58)',
        icon: 'neural'
      },
      {
        id: 'nlp',
        label: ['NLP'],
        nx: getCoord('nlp').nx, ny: getCoord('nlp').ny,
        baseR: 33,
        r: Math.round(33 * this.scale),
        gradient: ['#10B981', '#059669'],
        glow: 'rgba(16, 185, 129, 0.65)',
        icon: 'chat_doc'
      },
      {
        id: 'evidence',
        label: ['Project', 'Evidence'],
        nx: getCoord('evidence').nx, ny: getCoord('evidence').ny,
        baseR: 34,
        r: Math.round(34 * this.scale),
        gradient: ['#0284C7', '#0EA5E9'],
        glow: 'rgba(14, 165, 233, 0.65)',
        icon: 'certificate'
      },
      {
        id: 'mlops',
        label: ['MLOps'],
        nx: getCoord('mlops').nx, ny: getCoord('mlops').ny,
        baseR: 33,
        r: Math.round(33 * this.scale),
        gradient: ['#7C3AED', '#6366F1'],
        glow: 'rgba(124, 58, 237, 0.58)',
        icon: 'gear'
      },
      {
        id: 'ds',
        label: ['Data', 'Structures'],
        nx: getCoord('ds').nx, ny: getCoord('ds').ny,
        baseR: 33,
        r: Math.round(33 * this.scale),
        gradient: ['#EA580C', '#F97316'],
        glow: 'rgba(234, 88, 12, 0.58)',
        icon: 'stack'
      },
      {
        id: 'math',
        label: ['Mathematics'],
        nx: getCoord('math').nx, ny: getCoord('math').ny,
        baseR: 33,
        r: Math.round(33 * this.scale),
        gradient: ['#0284C7', '#38BDF8'],
        glow: 'rgba(14, 165, 233, 0.58)',
        icon: 'pi'
      },
      {
        id: 'comm',
        label: ['Communication'],
        nx: getCoord('comm').nx, ny: getCoord('comm').ny,
        baseR: 33,
        r: Math.round(33 * this.scale),
        gradient: ['#6366F1', '#8B5CF6'],
        glow: 'rgba(99, 102, 241, 0.58)',
        icon: 'speech'
      },
      {
        id: 'ds_science',
        label: ['Data', 'Science'],
        nx: getCoord('ds_science').nx, ny: getCoord('ds_science').ny,
        baseR: 34,
        r: Math.round(34 * this.scale),
        gradient: ['#F43F5E', '#FB7185'],
        glow: 'rgba(244, 63, 94, 0.58)',
        icon: 'scatter'
      }
    ];

    this.nodes.forEach(n => {
      n.x = n.nx * W;
      n.y = n.ny * H;
      n.originX = n.x;
      n.originY = n.y;
      n.vx = 0;
      n.vy = 0;
      n.appear = 1;
      n.floatPhase = Math.random() * Math.PI * 2;
    });

    const edgePairs = [
      ['ml', 'python'], ['ml', 'research'], ['ml', 'deep_learning'],
      ['ml', 'nlp'], ['ml', 'evidence'], ['ml', 'mlops'],
      ['ml', 'ds'], ['ml', 'math'], ['ml', 'comm'], ['ml', 'ds_science'],
      ['ds_science', 'python'], ['python', 'research'], ['research', 'deep_learning'],
      ['deep_learning', 'nlp'], ['nlp', 'evidence'], ['evidence', 'mlops'],
      ['mlops', 'ds'], ['ds', 'math'], ['math', 'comm'], ['comm', 'ds_science'],
      ['ds_science', 'research'], ['python', 'deep_learning'], ['research', 'nlp'],
      ['deep_learning', 'evidence'], ['nlp', 'mlops'], ['evidence', 'ds'],
      ['mlops', 'math'], ['ds_science', 'math'], ['comm', 'ds']
    ];

    this.edges = [];
    edgePairs.forEach(([idA, idB]) => {
      const a = this.nodes.find(n => n.id === idA);
      const b = this.nodes.find(n => n.id === idB);
      if (a && b) {
        const beadCount = 3 + Math.floor(Math.random() * 3);
        const beadColors = ['#38BDF8', '#F43F5E', '#FBBF24', '#C084FC', '#34D399', '#FB7185', '#A78BFA'];
        const beads = [];
        for (let k = 0; k < beadCount; k++) {
          beads.push({
            t: (k + 1) / (beadCount + 1),
            color: beadColors[(k + Math.floor(Math.random() * 3)) % beadColors.length],
            pulseOffset: Math.random() * Math.PI * 2,
            speed: (Math.random() - 0.5) * 0.003
          });
        }
        this.edges.push({ a, b, beads, bow: (Math.random() - 0.5) * 0.18 });
      }
    });
  }

  bindEvents() {
    const getPos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      const { x, y } = getPos(e);
      const hit = this.nodes.find(n => Math.hypot(n.x - x, n.y - y) <= n.r + 10);
      if (hit) {
        this.dragNode = hit;
        this.dragOffset = { x: hit.x - x, y: hit.y - y };
        this.canvas.setPointerCapture(e.pointerId);
        if (typeof sfx !== 'undefined' && sfx.chime) sfx.chime(440, 0.08, 'sine');
      } else {
        this.plantSkillAt(x, y);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const { x, y } = getPos(e);
      if (this.dragNode) {
        this.dragNode.x = Math.max(this.dragNode.r, Math.min(this.W - this.dragNode.r, x + this.dragOffset.x));
        this.dragNode.y = Math.max(this.dragNode.r, Math.min(this.H - this.dragNode.r, y + this.dragOffset.y));
        this.dragNode.vx = 0;
        this.dragNode.vy = 0;
      } else {
        const hit = this.nodes.find(n => Math.hypot(n.x - x, n.y - y) <= n.r + 10);
        this.canvas.style.cursor = hit ? 'grab' : 'crosshair';
      }
    });

    const endDrag = (e) => {
      if (this.dragNode) {
        try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
        this.dragNode = null;
        this.canvas.style.cursor = 'grab';
      }
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
  }

  plantRandomSkill() {
    const W = this.W || 720, H = this.H || 480;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.min(W, H) * (0.32 + Math.random() * 0.14);
    const x = Math.max(45, Math.min(W - 45, W * 0.5 + Math.cos(angle) * dist));
    const y = Math.max(45, Math.min(H - 45, H * 0.5 + Math.sin(angle) * dist));
    this.plantSkillAt(x, y);
  }

  plantSkillAt(x, y) {
    const preset = this.extraSkills[this.plantIdx % this.extraSkills.length];
    this.plantIdx++;

    const baseR = 30;
    const r = Math.round(baseR * (this.scale || 1.0));

    const newNode = {
      id: `planted_${Date.now()}`,
      label: preset.label,
      nx: x / (this.W || 720),
      ny: y / (this.H || 480),
      baseR,
      r,
      gradient: preset.gradient,
      glow: preset.glow,
      icon: preset.icon,
      x, y,
      originX: x, originY: y,
      vx: 0, vy: 0,
      appear: 0,
      floatPhase: Math.random() * Math.PI * 2
    };

    this.nodes.push(newNode);

    const sorted = [...this.nodes]
      .filter(n => n !== newNode)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
      .slice(0, 3);

    const beadColors = ['#38BDF8', '#F43F5E', '#FBBF24', '#C084FC', '#34D399'];
    sorted.forEach(target => {
      const beadCount = 3 + Math.floor(Math.random() * 3);
      const beads = [];
      for (let k = 0; k < beadCount; k++) {
        beads.push({
          t: (k + 1) / (beadCount + 1),
          color: beadColors[(k + Math.floor(Math.random() * 3)) % beadColors.length],
          pulseOffset: Math.random() * Math.PI * 2,
          speed: (Math.random() - 0.5) * 0.003
        });
      }
      this.edges.push({ a: newNode, b: target, beads, bow: (Math.random() - 0.5) * 0.18 });
    });

    this.ripples.push({ x, y, r: 8, alpha: 0.95, color: preset.gradient[0] });

    if (typeof sfx !== 'undefined' && sfx.chime) {
      sfx.chime(523.25 + (this.nodes.length % 6) * 45, 0.15, 'sine');
    }
  }

  stepPhysics() {
    this.time++;

    this.nodes.forEach(n => {
      n.appear += (1 - n.appear) * 0.14;
      if (n === this.dragNode) return;

      const floatAmp = n.isCenter ? 0.4 : (this.isMobile ? 0.6 : 1.2);
      const targetX = n.originX + Math.sin(this.time * 0.02 + n.floatPhase) * floatAmp;
      const targetY = n.originY + Math.cos(this.time * 0.025 + n.floatPhase) * floatAmp;

      const dx = targetX - n.x;
      const dy = targetY - n.y;
      n.vx = (n.vx + dx * 0.03) * 0.82;
      n.vy = (n.vy + dy * 0.03) * 0.82;

      n.x += n.vx;
      n.y += n.vy;
    });

    // Collision separation & bounds protection to guarantee zero bubble overlap
    const pad = 4;
    for (let i = 0; i < this.nodes.length; i++) {
      const n1 = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n2 = this.nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = n1.r + n2.r + (this.isMobile ? 6 : 8);
        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.5;
          const ux = dx / dist;
          const uy = dy / dist;
          if (n1 !== this.dragNode && !n1.isCenter) {
            n1.x -= ux * overlap;
            n1.y -= uy * overlap;
          }
          if (n2 !== this.dragNode && !n2.isCenter) {
            n2.x += ux * overlap;
            n2.y += uy * overlap;
          }
        }
      }
      if (n1 !== this.dragNode) {
        n1.x = Math.max(n1.r + pad, Math.min(this.W - n1.r - pad, n1.x));
        n1.y = Math.max(n1.r + pad, Math.min(this.H - n1.r - pad, n1.y));
      }
    }

    this.ripples.forEach(r => {
      r.r += 3.2;
      r.alpha *= 0.91;
    });
    this.ripples = this.ripples.filter(r => r.alpha > 0.03);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    if (!this.visible) return;
    this.stepPhysics();
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.ripples.forEach(r => {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    this.edges.forEach(edge => {
      const { a, b, beads, bow } = edge;
      if (!a || !b) return;

      const midX = (a.x + b.x) * 0.5;
      const midY = (a.y + b.y) * 0.5;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const curveAmount = (bow || 0.1) * Math.min(dist, 160);
      const ctrlX = midX + perpX * curveAmount;
      const ctrlY = midY + perpY * curveAmount;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);

      const lineGrad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      lineGrad.addColorStop(0, a.gradient[1] || '#EC4899');
      lineGrad.addColorStop(1, b.gradient[0] || '#7C3AED');

      ctx.strokeStyle = lineGrad;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.globalAlpha = 1;

      beads.forEach(bead => {
        bead.t = (bead.t + (bead.speed || 0.001) + 1) % 1;
        const t = bead.t;
        const bx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrlX + t * t * b.x;
        const by = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrlY + t * t * b.y;

        const pulse = 1 + 0.2 * Math.sin(this.time * 0.06 + bead.pulseOffset);

        ctx.beginPath();
        ctx.arc(bx, by, 7.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = bead.color;
        ctx.globalAlpha = 0.35;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.95;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = bead.color;
        ctx.globalAlpha = 1;
        ctx.fill();
      });
    });

    this.nodes.forEach(n => {
      const r = n.r * (0.3 + 0.7 * (n.appear || 1));

      const aura = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r * 2.2);
      aura.addColorStop(0, n.glow);
      aura.addColorStop(0.55, n.glow.replace(/[\d\.]+\)$/, '0.22)'));
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      const grad = ctx.createLinearGradient(n.x - r, n.y - r, n.x + r, n.y + r);
      grad.addColorStop(0, n.gradient[0]);
      grad.addColorStop(1, n.gradient[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y - r * 0.45, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();

      this.drawNodeContent(n, r);
    });
  }

  drawNodeContent(n, r) {
    const ctx = this.ctx;
    ctx.save();

    const isCenter = n.isCenter;
    const isSingleLine = n.label.length === 1;
    const s = this.scale || 1.0;

    const iconSize = Math.max(12, Math.round((isCenter ? 24 : 18) * s));
    const iconY = isCenter ? n.y - (12 * s) : (isSingleLine ? n.y - (7 * s) : n.y - (10 * s));
    this.drawIcon(ctx, n.icon, n.x, iconY, iconSize);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';

    if (isCenter) {
      const fs = Math.max(9, Math.round(12.5 * s));
      ctx.font = `800 ${fs}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(n.label[0], n.x, n.y + (9 * s));
      ctx.fillText(n.label[1], n.x, n.y + (21 * s));
    } else if (isSingleLine) {
      const fs = Math.max(7.5, Math.round(11 * s));
      ctx.font = `700 ${fs}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(n.label[0], n.x, n.y + (10 * s));
    } else {
      const fs = Math.max(7, Math.round(10 * s));
      ctx.font = `700 ${fs}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(n.label[0], n.x, n.y + (7 * s));
      ctx.fillText(n.label[1], n.x, n.y + (17 * s));
    }

    ctx.restore();
  }

  drawIcon(ctx, icon, x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    if (icon === 'pi') {
      ctx.font = 'bold 22px serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('π', 0, 0);
      ctx.restore();
      return;
    }

    ctx.scale(size / 24, size / 24);
    ctx.translate(-12, -12);

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (icon) {
      case 'brain': {
        ctx.beginPath();
        ctx.arc(8, 7, 3.5, 0, Math.PI * 2);
        ctx.arc(6, 12, 3.5, 0, Math.PI * 2);
        ctx.arc(9, 16, 3, 0, Math.PI * 2);
        ctx.arc(16, 7, 3.5, 0, Math.PI * 2);
        ctx.arc(18, 12, 3.5, 0, Math.PI * 2);
        ctx.arc(15, 16, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(12, 4); ctx.lineTo(12, 20);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }
      case 'python': {
        ctx.beginPath();
        ctx.roundRect(5, 4, 8, 8, 3);
        ctx.roundRect(11, 10, 8, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(7.5, 6.5, 1.2, 0, Math.PI * 2);
        ctx.arc(16.5, 15.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'document': {
        ctx.beginPath();
        ctx.moveTo(6, 3); ctx.lineTo(14, 3); ctx.lineTo(18, 7); ctx.lineTo(18, 21); ctx.lineTo(6, 21);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(9, 11); ctx.lineTo(15, 11);
        ctx.moveTo(9, 14); ctx.lineTo(15, 14);
        ctx.moveTo(9, 17); ctx.lineTo(13, 17);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }
      case 'neural': {
        ctx.beginPath();
        ctx.arc(7, 7, 3, 0, Math.PI * 2);
        ctx.arc(17, 7, 3, 0, Math.PI * 2);
        ctx.arc(12, 17, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, 7); ctx.lineTo(17, 7);
        ctx.moveTo(7, 7); ctx.lineTo(12, 17);
        ctx.moveTo(17, 7); ctx.lineTo(12, 17);
        ctx.stroke();
        break;
      }
      case 'chat_doc': {
        ctx.beginPath();
        ctx.roundRect(4, 4, 16, 12, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, 16); ctx.lineTo(4, 20); ctx.lineTo(11, 16);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, 8); ctx.lineTo(17, 8);
        ctx.moveTo(7, 11); ctx.lineTo(14, 11);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.stroke();
        break;
      }
      case 'certificate': {
        ctx.beginPath();
        ctx.moveTo(6, 4); ctx.lineTo(18, 4); ctx.lineTo(18, 16); ctx.lineTo(12, 20); ctx.lineTo(6, 16);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, 10, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
        break;
      }
      case 'gear': {
        ctx.beginPath();
        ctx.arc(12, 12, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, 12, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#1E293B';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(12 + Math.cos(a) * 6, 12 + Math.sin(a) * 6);
          ctx.lineTo(12 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 9.5);
          ctx.stroke();
        }
        break;
      }
      case 'stack': {
        ctx.beginPath();
        ctx.ellipse(12, 6, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.ellipse(12, 12, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.ellipse(12, 18, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'speech': {
        ctx.beginPath();
        ctx.roundRect(4, 5, 16, 11, 4);
        ctx.moveTo(7, 16); ctx.lineTo(4, 20); ctx.lineTo(10, 16);
        ctx.fill();
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(8, 10.5, 1.2, 0, Math.PI * 2);
        ctx.arc(12, 10.5, 1.2, 0, Math.PI * 2);
        ctx.arc(16, 10.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'scatter': {
        ctx.beginPath();
        ctx.arc(6, 14, 2.8, 0, Math.PI * 2);
        ctx.arc(17, 7, 2.8, 0, Math.PI * 2);
        ctx.arc(18, 17, 2.8, 0, Math.PI * 2);
        ctx.arc(11, 8, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, 14); ctx.lineTo(11, 8); ctx.lineTo(17, 7);
        ctx.moveTo(6, 14); ctx.lineTo(18, 17);
        ctx.stroke();
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(12, 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

const skillCanvasEl = document.getElementById('skillCanvas');
const skillGraph = skillCanvasEl ? new SkillConstellationGraph(skillCanvasEl) : null;

const plantSkillBtn = document.getElementById('plantSkillBtn');
if (plantSkillBtn && skillGraph) {
  plantSkillBtn.addEventListener('click', () => {
    skillGraph.plantRandomSkill();
    if (typeof sfx !== 'undefined' && sfx.chime) sfx.chime(523.25, 0.12, 'sine');
  });
}

/* ============================================================
   STUDENT STORIES · SHUFFLED BY PROOF (3D COVERFLOW & SHUFFLE)
============================================================ */
function initReviewShuffle() {
  const stage = document.getElementById('storiesStage');
  const dotsRow = document.getElementById('storiesDotsRow');
  const wrapper = document.getElementById('storiesCoverflowWrap');
  if (!stage) return;

  const stories = [
    {
      chip: {
        campus: 'IIT Delhi',
        logo: '/img/logos/iitd.webp',
        bg: '#FFF1F2',
        border: 'rgba(244, 63, 94, 0.22)',
        color: '#E11D48'
      },
      tag: null,
      borderColor: '#8B5CF6',
      glowColor: 'rgba(139, 92, 246, 0.40)',
      title: 'From Hostel Project to',
      body: 'Turned a weekend project in guidance and opportunity with verified code reviews and global community feedback.',
      authorName: 'Arjun M.',
      authorMeta: 'CSE · IIT Delhi',
      avatar: '/img/avatar_arjun-160.webp',
      hasProof: false
    },
    {
      chip: {
        campus: 'NIT Trichy',
        logo: '/img/logos/nitt.webp',
        bg: '#FFF1F2',
        border: 'rgba(244, 63, 94, 0.22)',
        color: '#FF385C'
      },
      tag: '✦ Alumni Mentorship',
      tagBg: '#ECFDF5',
      tagColor: '#059669',
      tagBorder: '#A7F3D0',
      borderColor: '#FF385C',
      glowColor: 'rgba(255, 56, 92, 0.50)',
      title: 'Solved Campus Bus Tracking Bottleneck',
      body: 'Received live code review in Meet room from a senior alumnus at Google who helped optimize our real-time graph traversal algorithm.',
      authorName: 'Divya R.',
      authorMeta: 'ECE Senior · NIT Trichy',
      avatar: '/img/avatar_divya-160.webp',
      hasProof: true,
      proofText: '15-Min Live Guidance',
      proofColor: '#FF385C'
    },
    {
      chip: null,
      tag: '✦ Research Opportunity',
      tagBg: '#FEF3C7',
      tagColor: '#D97706',
      tagBorder: '#FDE68A',
      borderColor: '#F59E0B',
      glowColor: 'rgba(245, 158, 11, 0.42)',
      title: 'Got into a Research Lab',
      body: 'My research idea from a paper I uploaded got noticed by a professor in our university.',
      authorName: 'Karan S.',
      authorMeta: 'BTech · IIT Bombay',
      avatar: '/img/avatar_karan-160.webp',
      hasProof: false
    },
    {
      chip: null,
      tag: '✦ Early Internship',
      tagBg: '#ECFDF5',
      tagColor: '#059669',
      tagBorder: '#A7F3D0',
      borderColor: '#10B981',
      glowColor: 'rgba(16, 185, 129, 0.35)',
      title: 'Fast-Tracked ML Fellowship',
      body: 'Turned a late-night PyTorch repo into an accepted corporate research fellowship.',
      authorName: 'Rohan M.',
      authorMeta: 'Dual Degree AI · IIT Madras',
      avatar: '/img/avatar_rohan-160.webp',
      hasProof: false
    },
    {
      chip: null,
      tag: '✦ Hackathon Winner',
      tagBg: '#FDF2F8',
      tagColor: '#DB2777',
      tagBorder: '#FBCFE8',
      borderColor: '#EC4899',
      glowColor: 'rgba(236, 72, 153, 0.35)',
      title: 'Found 3 Teammates in 10 Minutes',
      body: 'Paired my ML model with a frontend designer and data pitch specialist from Collaborate room.',
      authorName: 'Ananya S.',
      authorMeta: 'BTech · BITS Pilani',
      avatar: '/img/avatar_ananya-160.webp',
      hasProof: false
    }
  ];

  let currentIdx = 1; // Divya R. (NIT Trichy) at center initially, matching screenshot
  let autoTimer = null;
  let isHovered = false;

  function renderStage() {
    stage.innerHTML = stories.map((s, i) => `
      <article class="story-card" data-idx="${i}" style="--card-border:${s.borderColor}; --card-glow:${s.glowColor}; --card-accent:${s.borderColor}">
        <div class="story-top">
          ${s.chip ? `
          <div class="story-campus-chip" style="--chip-bg:${s.chip.bg}; --chip-border:${s.chip.border}">
            <img src="${s.chip.logo}" alt="${s.chip.campus} logo" class="story-chip-logo" onerror="this.style.display='none'" />
            <span class="story-chip-name" style="color:${s.chip.color}">${s.chip.campus}</span>
          </div>` : '<div></div>'}
          ${s.tag ? `<div class="story-tag-badge" style="--tag-bg:${s.tagBg}; --tag-color:${s.tagColor}; --tag-border:${s.tagBorder}">${s.tag}</div>` : ''}
        </div>

        <div class="story-body">
          <h3 class="story-headline">${s.title}</h3>
          <p class="story-desc">${s.body}</p>
        </div>

        <div class="story-footer">
          <div class="story-author-block">
            <img src="${s.avatar}" alt="${s.authorName}" class="story-author-avatar" onerror="this.src='/img/avatar_divya-160.webp'" />
            <div>
              <div class="story-author-name">${s.authorName}</div>
              <div class="story-author-meta">${s.authorMeta}</div>
            </div>
          </div>
          ${s.hasProof ? `
          <div class="story-proof-pill" style="--card-accent:${s.proofColor}">
            <div class="story-proof-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF385C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <span class="story-proof-text">${s.proofText}</span>
          </div>` : ''}
        </div>
      </article>
    `).join('');

    if (dotsRow) {
      dotsRow.innerHTML = stories.map((_, i) =>
        `<button type="button" class="story-dot ${i === currentIdx ? 'active' : 'inactive'}" data-idx="${i}" aria-label="Go to story ${i + 1}"></button>`
      ).join('');

      dotsRow.querySelectorAll('.story-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          goToIdx(+dot.getAttribute('data-idx'));
        });
      });
    }

    stage.querySelectorAll('.story-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = +card.getAttribute('data-idx');
        if (idx !== currentIdx) {
          goToIdx(idx);
        } else {
          nextStory();
        }
      });
    });

    updateCardPositions();
  }

  function updateCardPositions() {
    const cards = Array.from(stage.querySelectorAll('.story-card'));
    const total = stories.length;

    cards.forEach((card, idx) => {
      let diff = (idx - currentIdx) % total;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;

      card.classList.remove('pos-center', 'pos-left-1', 'pos-right-1', 'pos-left-2', 'pos-right-2', 'pos-hidden');

      if (diff === 0) {
        card.classList.add('pos-center');
      } else if (diff === -1) {
        card.classList.add('pos-left-1');
      } else if (diff === 1) {
        card.classList.add('pos-right-1');
      } else if (diff === -2) {
        card.classList.add('pos-left-2');
      } else if (diff === 2) {
        card.classList.add('pos-right-2');
      } else {
        card.classList.add('pos-hidden');
      }
    });

    if (dotsRow) {
      dotsRow.querySelectorAll('.story-dot').forEach((dot, i) => {
        dot.className = `story-dot ${i === currentIdx ? 'active' : 'inactive'}`;
      });
    }
  }

  function nextStory() {
    currentIdx = (currentIdx + 1) % stories.length;
    updateCardPositions();
    if (typeof sfx !== 'undefined' && sfx.chime) {
      sfx.chime(523.25 + (currentIdx % 5) * 45, 0.08, 'sine');
    }
  }

  function prevStory() {
    currentIdx = (currentIdx - 1 + stories.length) % stories.length;
    updateCardPositions();
    if (typeof sfx !== 'undefined' && sfx.chime) {
      sfx.chime(440, 0.08, 'sine');
    }
  }

  function goToIdx(idx) {
    if (currentIdx === idx) return;
    currentIdx = idx;
    updateCardPositions();
    if (typeof sfx !== 'undefined' && sfx.chime) {
      sfx.chime(580, 0.08, 'sine');
    }
  }

  renderStage();

  if (wrapper) {
    wrapper.addEventListener('pointerenter', () => isHovered = true);
    wrapper.addEventListener('pointerleave', () => isHovered = false);
  }

  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { nextStory(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { prevStory(); e.preventDefault(); }
  });

  if (typeof RM === 'undefined' || !RM) {
    autoTimer = setInterval(() => {
      if (!isHovered && document.visibilityState === 'visible') {
        nextStory();
      }
    }, 4500);
  }
}
initReviewShuffle();

/* ============================================================
   BENTO BUILD (PATTERN F) & COMPARE TABLE (PATTERN K)
============================================================ */
function initBentoAndCompare() {
  const bentoGrid = document.querySelector('.bento');
  if (bentoGrid) {
    const bentoObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          bentoGrid.classList.add('in');
          bentoObs.unobserve(bentoGrid);
        }
      });
    }, { threshold: 0.15 });
    bentoObs.observe(bentoGrid);
  }

  const compareSection = document.getElementById('compare');
  const compareRows = document.querySelectorAll('.compare-row');
  if (compareSection && compareRows.length) {
    const compObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          compareRows.forEach((row, i) => {
            setTimeout(() => {
              row.classList.add('in');
            }, RM ? 0 : i * 160);
          });
          compObs.unobserve(compareSection);
        }
      });
    }, { threshold: 0.18 });
    compObs.observe(compareSection);
  }
}
initBentoAndCompare();

/* ============================================================
   COUNT-UP STATISTICS (PATTERN E)
============================================================ */
function animateCounter(el, start, end, duration = 1800, suffix = '') {
  if (!el) return;
  if (RM) {
    el.textContent = end + suffix;
    return;
  }
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = Math.round(start + (end - start) * ease);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function initCountUpStatistics() {
  const statPills = document.querySelectorAll('.up-stat-pill');
  if (statPills.length) {
    const stage = document.getElementById('unified-profile-stage');
    if (stage) {
      const ioStage = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            statPills.forEach(pill => {
              const text = pill.innerText;
              const match = text.match(/(\d+)/);
              if (match) {
                const target = parseInt(match[1], 10);
                const label = pill.querySelector('span') ? pill.querySelector('span').outerHTML : '';
                animateCounter({
                  set textContent(v) {
                    pill.innerHTML = `${label} ${v}`;
                  }
                }, 0, target, 1600);
              }
            });
            ioStage.unobserve(stage);
          }
        });
      }, { threshold: 0.25 });
      ioStage.observe(stage);
    }
  }

  const joinSec = document.getElementById('join');
  const holoScoreEl = document.getElementById('holoScore');
  const holoMatchesEl = document.getElementById('holoMatches');
  if (joinSec && holoScoreEl) {
    const ioJoin = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCounter({
            set textContent(v) {
              holoScoreEl.textContent = `${v}% Verified`;
            }
          }, 0, 94, 2000);
          if (holoMatchesEl) {
            animateCounter({
              set textContent(v) {
                holoMatchesEl.textContent = `${v} Matches`;
              }
            }, 0, 12, 1700);
          }
          ioJoin.unobserve(joinSec);
        }
      });
    }, { threshold: 0.2 });
    ioJoin.observe(joinSec);
  }
}
initCountUpStatistics();

/* ============================================================
   CURSOR TOUR (PATTERN G) & CLICK -> SUCCESS (PATTERN L)
============================================================ */
function initTourAndSubmission() {
  const startTourBtn = document.getElementById('startTourBtn');
  const tourCursor = document.getElementById('tourCursor');
  const tourLabel = document.getElementById('tourCursorLabel');
  const mintBtn = document.getElementById('mintProfileBtn');
  const mintBtnText = document.getElementById('mintBtnText');
  let tourRunning = false;
  let tourTimeout = null;

  function stopTour(reason = 'interrupted') {
    if (!tourRunning) return;
    tourRunning = false;
    clearTimeout(tourTimeout);
    if (tourCursor) {
      tourCursor.classList.remove('active', 'clicking');
      tourCursor.style.opacity = '0';
    }
    if (reason === 'user') {
      showToast('✦ Tour ended — you are in control!');
    }
  }

  window.addEventListener('pointerdown', (e) => {
    if (tourRunning && !e.target.closest('#startTourBtn')) {
      stopTour('user');
    }
  });

  if (startTourBtn && tourCursor && !RM) {
    startTourBtn.addEventListener('click', () => {
      if (tourRunning) return;
      tourRunning = true;
      sfx.chime(659.25, 0.15, 'triangle');
      document.getElementById('join').scrollIntoView({ behavior: 'smooth' });

      setTimeout(() => {
        if (!tourRunning) return;
        tourCursor.classList.add('active');
        tourCursor.style.opacity = '1';

        const badges = Array.from(document.querySelectorAll('.badge-toggle'));
        const researchBadge = badges.find(b => b.getAttribute('data-badge').includes('Research Paper'));
        if (researchBadge) {
          const r1 = researchBadge.getBoundingClientRect();
          tourCursor.style.transform = `translate3d(${r1.left + r1.width / 2}px, ${r1.top + r1.height / 2}px, 0)`;
          tourLabel.textContent = 'Linking Research Paper...';

          tourTimeout = setTimeout(() => {
            if (!tourRunning) return;
            tourCursor.classList.add('clicking');
            researchBadge.click();

            setTimeout(() => {
              if (!tourRunning) return;
              tourCursor.classList.remove('clicking');

              const osBadge = badges.find(b => b.getAttribute('data-badge').includes('Open Source'));
              if (osBadge) {
                const r2 = osBadge.getBoundingClientRect();
                tourCursor.style.transform = `translate3d(${r2.left + r2.width / 2}px, ${r2.top + r2.height / 2}px, 0)`;
                tourLabel.textContent = 'Linking Open Source commits...';

                tourTimeout = setTimeout(() => {
                  if (!tourRunning) return;
                  tourCursor.classList.add('clicking');
                  osBadge.click();

                  setTimeout(() => {
                    if (!tourRunning) return;
                    tourCursor.classList.remove('clicking');

                    if (mintBtn) {
                      const r3 = mintBtn.getBoundingClientRect();
                      tourCursor.style.transform = `translate3d(${r3.left + r3.width / 2}px, ${r3.top + r3.height / 2}px, 0)`;
                      tourLabel.textContent = 'Minting verified cryptographic profile...';

                      tourTimeout = setTimeout(() => {
                        if (!tourRunning) return;
                        tourCursor.classList.add('clicking');
                        mintBtn.click();

                        setTimeout(() => {
                          tourCursor.classList.remove('clicking');
                          tourLabel.textContent = '✓ Verified Profile Created!';
                          tourTimeout = setTimeout(() => stopTour('complete'), 1500);
                        }, 400);
                      }, 850);
                    }
                  }, 400);
                }, 850);
              }
            }, 400);
          }, 850);
        }
      }, 450);
    });
  }

  // PATTERN L: Click -> Success State Machine
  if (mintBtn) {
    mintBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('profNameInput');
      const campusInput = document.getElementById('profCampusInput');
      const name = nameInput ? nameInput.value.trim() : '';

      if (!name) {
        if (nameInput) {
          nameInput.classList.add('input-error-shake');
          nameInput.focus();
          setTimeout(() => nameInput.classList.remove('input-error-shake'), 450);
        }
        showToast('⚠️ Please enter your name to verify your profile');
        sfx.chime(220, 0.2, 'sawtooth');
        return;
      }

      if (mintBtn.classList.contains('minting') || mintBtn.classList.contains('success')) return;

      mintBtn.classList.add('minting');
      mintBtn.setAttribute('aria-busy', 'true');
      if (mintBtnText) {
        mintBtnText.innerHTML = '<span class="btn-spinner"></span> Minting Proof...';
      }
      sfx.chime(440, 0.12, 'sine');

      setTimeout(() => {
        mintBtn.classList.remove('minting');
        mintBtn.classList.add('success');
        mintBtn.removeAttribute('aria-busy');
        if (mintBtnText) {
          mintBtnText.innerHTML = '✓ Profile Verified!';
        }

        sfx.chord([523.25, 659.25, 783.99, 1046.5]);
        const card = document.getElementById('holoCard');
        if (card) {
          card.style.transform = 'perspective(1000px) rotateY(360deg) scale(1.05)';
          setTimeout(() => { card.style.transform = ''; }, 700);
        }

        const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'builder';
        showToast(`✦ Verified Profile Minted: aitathastu.org/@${handle}`);

        setTimeout(() => {
          mintBtn.classList.remove('success');
          if (mintBtnText) {
            mintBtnText.innerHTML = `Copy Profile Link 📋`;
          }
          const copyHandler = () => {
            navigator.clipboard?.writeText?.(`https://aitathastu.org/@${handle}`);
            showToast(`📋 Copied aitathastu.org/@${handle} to clipboard!`);
            sfx.chime(784, 0.12, 'sine');
          };
          mintBtn.onclick = copyHandler;
        }, 2600);
      }, 750);
    });
  }
}
initTourAndSubmission();

/* ============================================================
   14. SCROLL CHOREOGRAPHY (Progress Bar, Quote Scrub, Timeline Spine)
============================================================ */
const heroCopy = document.querySelector('.ref-hero-copy');
const scrollBar = document.getElementById('scrollBar');
const timelineBox = document.getElementById('timelineBox');
const timelineFill = document.getElementById('timelineFill');
const svgTimelineFill = document.getElementById('timelineSvgTrackFill');
const tlItems = document.querySelectorAll('.tl-item');
const stepNodes = document.querySelectorAll('.step-node');
const stepTones = [392, 440, 493.88, 587.33, 659.25];

function activateStep(stepNum) {
  stepNodes.forEach(node => {
    node.classList.toggle('active-step', node.dataset.step === String(stepNum));
  });
  tlItems.forEach(item => {
    item.classList.toggle('active-step', item.dataset.step === String(stepNum));
  });
  const tone = stepTones[parseInt(stepNum, 10) - 1] || 493.88;
  if (window.sfx && typeof sfx.chime === 'function') {
    sfx.chime(tone, 0.12, 'triangle');
  }
}

stepNodes.forEach(node => {
  node.addEventListener('click', () => {
    activateStep(node.dataset.step);
  });
});

tlItems.forEach(item => {
  item.addEventListener('click', () => {
    activateStep(item.dataset.step);
  });
});

function onScrollChoreography() {
  const scrollTop = window.scrollY;
  const docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const pct = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
  if (scrollBar) scrollBar.style.transform = `scaleX(${(pct / 100).toFixed(4)})`;

  const heroP = Math.min(scrollTop / (window.innerHeight * 0.78), 1);
  if (heroCopy && !RM) {
    heroCopy.style.opacity = String(Math.max(0.2, 1 - heroP * 0.8));
    heroCopy.style.transform = `translateY(${-heroP * 14}px)`;
  }



  if (timelineBox) {
    const r = timelineBox.getBoundingClientRect();
    const prog = (window.innerHeight * 0.68 - r.top) / r.height;
    const clamped = Math.max(0, Math.min(1, prog));
    if (timelineFill) timelineFill.style.height = `${(clamped * 100).toFixed(1)}%`;
    if (svgTimelineFill) {
      svgTimelineFill.style.strokeDashoffset = String(1400 * (1 - clamped));
    }
    if (clamped > 0.05) {
      const currentStep = Math.min(4, Math.floor(clamped * 4) + 1);
      stepNodes.forEach((node, idx) => {
        node.classList.toggle('active-step', (idx + 1) === currentStep);
      });
      tlItems.forEach((item, idx) => {
        item.classList.toggle('active-step', (idx + 1) === currentStep);
      });
    }
  }
}
onScrollFrame(onScrollChoreography);
onScrollChoreography();

/* ============================================================
   BUTTON RIPPLE, TOAST & INTERSECTION REVEAL
============================================================ */
function showToast(msg) {
  const t = document.getElementById('toastNotice');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const r = btn.getBoundingClientRect();
    const rip = document.createElement('span');
    rip.className = 'btn-ripple';
    rip.style.left = (e.clientX - r.left) + 'px';
    rip.style.top  = (e.clientY - r.top)  + 'px';
    btn.appendChild(rip);
    setTimeout(() => rip.remove(), 750);
  });
});

const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: 0.05, rootMargin: '0px 0px 80px 0px' });

document.querySelectorAll('.rv').forEach((el, i) => {
  el.style.transitionDelay = (i % 4) * 45 + 'ms';
  io.observe(el);
});


// Immediately reveal elements that are already in or near view
function revealVisibleRv() {
  const vh = window.innerHeight || 800;
  document.querySelectorAll('.rv:not(.in)').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < vh + 200) {
      el.classList.add('in');
    }
  });
}
revealVisibleRv();
onScrollFrame(revealVisibleRv);
setTimeout(revealVisibleRv, 150);
setTimeout(revealVisibleRv, 600);

/* ============================================================
   EXACT REFERENCE FOOTER INTERACTIONS
============================================================ */
function initFooterInteractions() {
  // Newsletter submission handler
  const form = document.getElementById('footerNewsletterForm');
  const input = document.getElementById('footerEmailInput');
  const submitBtn = document.getElementById('footerSubmitBtn');
  const consent = document.getElementById('footerConsentCheck');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

      if (!val || !validEmail) {
        input.classList.add('input-error-shake');
        setTimeout(() => input.classList.remove('input-error-shake'), 450);
        showToast('⚠️ Please enter a valid email address');
        return;
      }

      if (consent && !consent.checked) {
        showToast('⚠️ Please agree to receive updates');
        return;
      }

      if (typeof sfx !== 'undefined' && sfx.chord) {
        sfx.chord([523.25, 659.25, 783.99, 1046.5]);
      }

      if (submitBtn) {
        const origHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span style="font-size:1.15rem;font-weight:900;">✓</span>';
        submitBtn.style.background = '#16A34A';
        setTimeout(() => {
          submitBtn.innerHTML = origHTML;
          submitBtn.style.background = '';
        }, 3200);
      }

      input.value = '';
      showToast('✦ Thank you for subscribing to AI Tathastu updates!');
    });
  }

  // Dynamic copyright year
  const yearEl = document.getElementById('footerCurrentYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Language dropdown
  const langDropdown = document.getElementById('footerLangDropdown');
  const langBtn = document.getElementById('footerLangBtn');
  const currentLangLabel = document.getElementById('footerCurrentLang');
  const langOptions = document.querySelectorAll('.footer-lang-option');

  if (langBtn && langDropdown) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = langDropdown.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', String(isOpen));
      if (typeof sfx !== 'undefined' && sfx.chime) sfx.chime(493.88, 0.08, 'sine');
    });

    langOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.getAttribute('data-lang');
        if (currentLangLabel) currentLangLabel.textContent = lang;
        langOptions.forEach(o => o.classList.toggle('active', o === opt));
        langDropdown.classList.remove('open');
        langBtn.setAttribute('aria-expanded', 'false');
        if (typeof sfx !== 'undefined' && sfx.chime) sfx.chime(587.33, 0.1, 'sine');
        showToast(`🌐 Language set to ${lang}`);
      });
    });

    document.addEventListener('click', (e) => {
      if (!langDropdown.contains(e.target)) {
        langDropdown.classList.remove('open');
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}
initFooterInteractions();

/* ============================================================
   BACK TO TOP FLOATING PROGRESS BUTTON
============================================================ */
function initBackToTop() {
  let btt = document.getElementById('backToTopBtn');
  if (!btt) {
    btt = document.createElement('button');
    btt.id = 'backToTopBtn';
    btt.className = 'back-to-top-btn';
    btt.type = 'button';
    btt.setAttribute('aria-label', 'Back to top');
    btt.innerHTML = `
      <svg class="back-to-top-svg" viewBox="0 0 46 46" aria-hidden="true">
        <defs>
          <linearGradient id="bttGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF6B4A" />
            <stop offset="100%" stop-color="#FF2A85" />
          </linearGradient>
        </defs>
        <circle class="back-to-top-circle-bg" cx="23" cy="23" r="20" />
        <circle class="back-to-top-circle-progress" id="bttProgressCircle" cx="23" cy="23" r="20" />
      </svg>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:2;" aria-hidden="true">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;
    document.body.appendChild(btt);
    btt.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    });
  }

  const circle = document.getElementById('bttProgressCircle');
  const circumference = 2 * Math.PI * 20;

  function updateBtt() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollPct = Math.min(1, Math.max(0, scrollTop / docHeight));

    if (scrollTop > 380) {
      btt.classList.add('visible');
    } else {
      btt.classList.remove('visible');
    }

    if (circle) {
      const offset = circumference - scrollPct * circumference;
      circle.style.strokeDashoffset = String(offset);
    }
  }

  onScrollFrame(updateBtt);
  updateBtt();
}
initBackToTop();

if (typeof window !== 'undefined') {
  window.initAllLandingFeatures = function () {
    try { if (typeof initReferenceEcoConnections === 'function') initReferenceEcoConnections(); } catch (_) {}
    try { if (typeof initReferenceMeshWaves === 'function') initReferenceMeshWaves(); } catch (_) {}
    try { if (typeof initReferenceStripCarousel === 'function') initReferenceStripCarousel(); } catch (_) {}
    try { if (typeof initReviewShuffle === 'function') initReviewShuffle(); } catch (_) {}
    try { if (typeof initBentoAndCompare === 'function') initBentoAndCompare(); } catch (_) {}
    try { if (typeof initCountUpStatistics === 'function') initCountUpStatistics(); } catch (_) {}
    try { if (typeof initTourAndSubmission === 'function') initTourAndSubmission(); } catch (_) {}
    try { if (typeof initFooterInteractions === 'function') initFooterInteractions(); } catch (_) {}
    try { if (typeof initBackToTop === 'function') initBackToTop(); } catch (_) {}
    try { if (typeof initLandingModals === 'function') initLandingModals(); } catch (_) {}
    try { if (typeof initFaqAccordion === 'function') initFaqAccordion(); } catch (_) {}
  };
}


