/* ══════════════════════════════════════════════════════════════════════════
   antigravity.js — Physics-based gravity/anti-gravity animation
   Elements fall, can be dragged, collide with the viewport floor.
   Toggle: toggleGravity()
══════════════════════════════════════════════════════════════════════════ */

const GravityEngine = (function () {
  let active    = false;
  let elements  = [];
  let rafId     = null;
  let dragging  = null;
  let dragOffX  = 0, dragOffY = 0;

  const GRAVITY   = 0.45;   // pixels/frame²
  const BOUNCE    = 0.48;   // energy retained on floor bounce
  const FRICTION  = 0.985;  // horizontal friction
  const FLOOR_PAD = 10;     // px above viewport bottom

  /* ── Selectors to capture ─────────────────────────────────────────────── */
  const SELECTORS = [
    '.card', '.reference-box', '.record-panel', '.score-panel',
    '.feature-card', '.hero-content', '.hero-stats',
    '.auth-card', '.section', 'h1', 'h2', 'footer',
    '.sidebar-section-title', '.btn-primary', '.btn-ghost',
  ];

  /* ── Initialise elements ─────────────────────────────────────────────── */
  function capture() {
    elements = [];
    const seen = new Set();

    SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (seen.has(el)) return;
        if (el.closest('.nav') || el.closest('.gravity-btn') ||
            el.closest('.analyzing-overlay') || el.id === 'cursor-dot' ||
            el.id === 'cursor-ring' || el.tagName === 'CANVAS') return;
        seen.add(el);

        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);

        // Snapshot current position
        const item = {
          el,
          x:        rect.left + window.scrollX,
          y:        rect.top  + window.scrollY,
          w:        rect.width,
          h:        rect.height,
          vx:       (Math.random() - 0.5) * 3,
          vy:       Math.random() * -2 - 1,
          rotation: 0,
          vr:       (Math.random() - 0.5) * 2,
          origPosition: style.position,
          origLeft:     el.style.left,
          origTop:      el.style.top,
          origTransform: el.style.transform,
          origZIndex:   el.style.zIndex,
          origMargin:   el.style.margin,
        };

        el.classList.add('gravity-element');
        el.style.width     = rect.width  + 'px';
        el.style.height    = rect.height + 'px';
        el.style.left      = item.x + 'px';
        el.style.top       = item.y + 'px';
        el.style.margin    = '0';
        el.style.zIndex    = '300';

        elements.push(item);
      });
    });
  }

  /* ── Physics step ────────────────────────────────────────────────────── */
  function step() {
    const floorY = window.innerHeight + window.scrollY - FLOOR_PAD;

    elements.forEach(item => {
      if (item === dragging) return;

      item.vy += GRAVITY;
      item.x  += item.vx;
      item.y  += item.vy;
      item.rotation += item.vr;
      item.vx *= FRICTION;
      item.vr *= 0.97;

      // Floor collision
      if (item.y + item.h >= floorY) {
        item.y  = floorY - item.h;
        item.vy = -(item.vy * BOUNCE);
        item.vx *= 0.92;
        item.vr *= 0.7;
        if (Math.abs(item.vy) < 0.8) item.vy = 0;
      }

      // Wall collisions
      if (item.x < 0)                         { item.x = 0; item.vx = Math.abs(item.vx) * 0.5; }
      if (item.x + item.w > window.innerWidth) { item.x = window.innerWidth - item.w; item.vx = -Math.abs(item.vx) * 0.5; }

      item.el.style.left      = item.x + 'px';
      item.el.style.top       = item.y + 'px';
      item.el.style.transform = `rotate(${item.rotation}deg)`;
    });

    rafId = requestAnimationFrame(step);
  }

  /* ── Drag ────────────────────────────────────────────────────────────── */
  function onMouseDown(e) {
    const target = e.target.closest('.gravity-element');
    if (!target) return;
    const item = elements.find(el => el.el === target);
    if (!item) return;
    dragging   = item;
    dragOffX   = e.clientX - item.x;
    dragOffY   = e.clientY - item.y;
    item.vx    = 0; item.vy = 0; item.vr = 0;
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!dragging) return;
    const prevX = dragging.x, prevY = dragging.y;
    dragging.x = e.clientX - dragOffX;
    dragging.y = e.clientY - dragOffY;
    dragging.vx = (dragging.x - prevX) * 0.6;
    dragging.vy = (dragging.y - prevY) * 0.6;
    dragging.el.style.left = dragging.x + 'px';
    dragging.el.style.top  = dragging.y + 'px';
  }

  function onMouseUp() {
    dragging = null;
  }

  /* ── Touch drag support ──────────────────────────────────────────────── */
  function onTouchStart(e) {
    const t = e.touches[0];
    const target = document.elementFromPoint(t.clientX, t.clientY)?.closest('.gravity-element');
    if (!target) return;
    const item = elements.find(el => el.el === target);
    if (!item) return;
    dragging = item;
    dragOffX = t.clientX - item.x;
    dragOffY = t.clientY - item.y;
    item.vx = 0; item.vy = 0; item.vr = 0;
  }
  function onTouchMove(e) {
    if (!dragging) return;
    const t = e.touches[0];
    const prevX = dragging.x, prevY = dragging.y;
    dragging.x = t.clientX - dragOffX;
    dragging.y = t.clientY - dragOffY;
    dragging.vx = (dragging.x - prevX) * 0.6;
    dragging.vy = (dragging.y - prevY) * 0.6;
    dragging.el.style.left = dragging.x + 'px';
    dragging.el.style.top  = dragging.y + 'px';
    e.preventDefault();
  }
  function onTouchEnd() { dragging = null; }

  /* ── Enable / Disable ────────────────────────────────────────────────── */
  function enable() {
    document.body.classList.add('antigravity-mode');
    capture();
    rafId = requestAnimationFrame(step);
    document.addEventListener('mousedown',  onMouseDown);
    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mouseup',    onMouseUp);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd);
  }

  function disable() {
    cancelAnimationFrame(rafId);
    document.body.classList.remove('antigravity-mode');
    document.removeEventListener('mousedown',  onMouseDown);
    document.removeEventListener('mousemove',  onMouseMove);
    document.removeEventListener('mouseup',    onMouseUp);
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove',  onTouchMove);
    document.removeEventListener('touchend',   onTouchEnd);

    // Restore original styles
    elements.forEach(item => {
      item.el.classList.remove('gravity-element');
      item.el.style.position  = item.origPosition;
      item.el.style.left      = item.origLeft;
      item.el.style.top       = item.origTop;
      item.el.style.transform = item.origTransform;
      item.el.style.zIndex    = item.origZIndex;
      item.el.style.margin    = item.origMargin;
      item.el.style.width     = '';
      item.el.style.height    = '';
    });
    elements = [];
    dragging = null;

    // Reload to cleanly restore layout
    setTimeout(() => window.location.reload(), 50);
  }

  return {
    toggle() {
      active = !active;
      if (active) enable(); else disable();
      return active;
    },
    isActive() { return active; }
  };
})();

/* ── Global toggle ─────────────────────────────────────────────────────── */
function toggleGravity() {
  const on = GravityEngine.toggle();
  const btn = document.getElementById('gravityBtn');
  if (btn) {
    btn.textContent = on ? '⚛ Disable Anti-Gravity' : '⚛ Enable Anti-Gravity Mode';
    btn.classList.toggle('active', on);
  }
  showToast(on ? '🌌 Anti-gravity engaged — drag elements around!' : '🌍 Gravity restored.');
}

/* ── Toast helper ──────────────────────────────────────────────────────── */
function showToast(msg, type = '') {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
