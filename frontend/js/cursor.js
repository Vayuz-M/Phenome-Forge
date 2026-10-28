/* ══════════════════════════════════════════════════════════════════════════
   cursor.js — Glowing cursor + smooth ring + canvas particle trail
   Uses plain canvas (no Three.js overhead) for the trail for performance.
══════════════════════════════════════════════════════════════════════════ */

(function () {
  const dot   = document.getElementById('cursor-dot');
  const ring  = document.getElementById('cursor-ring');
  const canvas = document.getElementById('cursor-trail-canvas');

  if (!dot || !ring || !canvas) return;

  const ctx = canvas.getContext('2d');

  // Resize canvas to window
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Mouse position
  let mouseX = -200, mouseY = -200;
  let ringX  = -200, ringY  = -200;

  // Trail particles
  const TRAIL_LENGTH = 22;
  const trail = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    trail.push({ x: -200, y: -200, age: i });
  }

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Shift trail forward
    for (let i = trail.length - 1; i > 0; i--) {
      trail[i].x = trail[i - 1].x;
      trail[i].y = trail[i - 1].y;
    }
    trail[0].x = mouseX;
    trail[0].y = mouseY;
  });

  // Cursor dot: snaps immediately
  // Cursor ring: lerps behind
  function animate() {
    // Dot
    dot.style.left = mouseX + 'px';
    dot.style.top  = mouseY + 'px';

    // Ring lerp
    ringX += (mouseX - ringX) * 0.14;
    ringY += (mouseY - ringY) * 0.14;
    ring.style.left = ringX + 'px';
    ring.style.top  = ringY + 'px';

    // Trail canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < trail.length; i++) {
      const t      = 1 - i / trail.length; // 1 at head, 0 at tail
      const radius = t * 4;
      const alpha  = t * 0.45;

      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
      ctx.fill();
    }

    // Sparkle particle burst every ~6 frames at cursor tip
    if (Math.random() < 0.25) {
      const spark = { x: mouseX, y: mouseY, vx: (Math.random()-0.5)*2.5, vy: (Math.random()-0.5)*2.5, life: 1 };
      sparks.push(spark);
    }

    // Update + draw sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.04; // gravity
      s.life -= 0.06;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.5 * s.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167,139,250,${s.life * 0.7})`;
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  const sparks = [];
  animate();

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => {
    dot.style.opacity  = '0';
    ring.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    dot.style.opacity  = '1';
    ring.style.opacity = '1';
  });

  // Scale dot on click
  document.addEventListener('mousedown', () => {
    dot.style.transform  = 'translate(-50%,-50%) scale(1.8)';
    ring.style.transform = 'translate(-50%,-50%) scale(0.8)';
  });
  document.addEventListener('mouseup', () => {
    dot.style.transform  = 'translate(-50%,-50%) scale(1)';
    ring.style.transform = 'translate(-50%,-50%) scale(1)';
  });
})();
