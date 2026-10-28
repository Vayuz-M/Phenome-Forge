/* ══════════════════════════════════════════════════════════════════════════
   gamification.js — Phoneme Forge
   XP system, level progression, streak tracking, badges, dashboard init,
   weak word tracking, score trend chart.
══════════════════════════════════════════════════════════════════════════ */

/* ── XP / LEVEL TABLE ────────────────────────────────────────────────────── */
const LEVELS = [
  { level: 1,  xpMin: 0,    xpMax: 50,   title: 'Newcomer',     unlock: 'Basic sentences unlocked' },
  { level: 2,  xpMin: 50,   xpMax: 120,  title: 'Beginner',     unlock: 'Tongue twisters unlocked' },
  { level: 3,  xpMin: 120,  xpMax: 250,  title: 'Learner',      unlock: 'R-cluster lessons unlocked' },
  { level: 4,  xpMin: 250,  xpMax: 450,  title: 'Practitioner', unlock: 'Schwa power lesson unlocked' },
  { level: 5,  xpMin: 450,  xpMax: 700,  title: 'Intermediate', unlock: 'Advanced phoneme drills' },
  { level: 6,  xpMin: 700,  xpMax: 1000, title: 'Advanced',     unlock: 'Stress & intonation module' },
  { level: 7,  xpMin: 1000, xpMax: 1400, title: 'Expert',       unlock: 'Native speaker comparisons' },
  { level: 8,  xpMin: 1400, xpMax: 1900, title: 'Master',       unlock: 'All content unlocked' },
  { level: 9,  xpMin: 1900, xpMax: 2500, title: 'Legend',       unlock: 'Prestige badge awarded' },
  { level: 10, xpMin: 2500, xpMax: 9999, title: 'Grandmaster',  unlock: 'All badges unlocked' },
];

const LESSON_TRACK = [
  { id: 1, title: 'TH Sounds',       desc: 'Voiced & unvoiced TH',        icon: '🔊', minLevel: 1 },
  { id: 2, title: 'Vowel Stretch',   desc: 'Long vs short vowels',        icon: '🎵', minLevel: 1 },
  { id: 3, title: 'R Clusters',      desc: 'Consonant clusters with R',   icon: '🔤', minLevel: 2 },
  { id: 4, title: 'Schwa Power',     desc: 'Unstressed vowel mastery',    icon: '⚡', minLevel: 4 },
  { id: 5, title: 'Sibilants',       desc: 'S, Z, SH, ZH sounds',        icon: '🌊', minLevel: 3 },
  { id: 6, title: 'Stress Patterns', desc: 'Word & sentence stress',      icon: '📊', minLevel: 5 },
  { id: 7, title: 'Intonation',      desc: 'Rising & falling pitch',      icon: '🎤', minLevel: 6 },
  { id: 8, title: 'Connected Speech',desc: 'Linking & elision',           icon: '🔗', minLevel: 7 },
];

const BADGES = [
  { id: 'first_attempt', icon: '🌱', label: 'First Attempt',  desc: 'Completed your first practice', condition: s => s.totalAttempts >= 1 },
  { id: 'streak_3',      icon: '🔥', label: '3-Day Streak',   desc: 'Practiced 3 days in a row',     condition: s => s.streak >= 3 },
  { id: 'streak_7',      icon: '⚡', label: 'Week Warrior',   desc: '7-day streak',                  condition: s => s.streak >= 7 },
  { id: 'score_80',      icon: '🎯', label: 'Sharp Ear',      desc: 'Scored 80+ on any attempt',     condition: s => s.bestScore >= 80 },
  { id: 'score_95',      icon: '💎', label: 'Near Perfect',   desc: 'Scored 95+ on any attempt',     condition: s => s.bestScore >= 95 },
  { id: 'level_3',       icon: '🏅', label: 'Level 3',        desc: 'Reached Level 3',               condition: s => s.level >= 3 },
  { id: 'level_5',       icon: '🏆', label: 'Level 5',        desc: 'Reached Level 5',               condition: s => s.level >= 5 },
  { id: 'attempts_10',   icon: '💪', label: 'Determined',     desc: '10 practice attempts',          condition: s => s.totalAttempts >= 10 },
  { id: 'attempts_50',   icon: '🌟', label: 'Dedicated',      desc: '50 practice attempts',          condition: s => s.totalAttempts >= 50 },
];

/* ── STORAGE KEY ─────────────────────────────────────────────────────────── */
const STORE_KEY = 'pf_gamification';

/* ── STATE ────────────────────────────────────────────────────────────────── */
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || defaultState();
  } catch { return defaultState(); }
}

function defaultState() {
  return {
    xp: 0, level: 1, streak: 0,
    totalAttempts: 0, bestScore: 0, avgAccuracy: 0,
    weekXP: 0, lastPracticeDate: null,
    scores: [], weakWords: {},
    earnedBadges: [], lessonProgress: {},
    weekStart: getWeekStart(),
  };
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function getWeekStart() {
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString();
}

/* ── PUBLIC API ──────────────────────────────────────────────────────────── */
window.PF = {

  /* Award XP after a practice attempt */
  awardXP(score, wordDiff) {
    const state = loadState();
    const today = new Date().toDateString();

    // Update streak
    if (state.lastPracticeDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      state.streak = state.lastPracticeDate === yesterday ? state.streak + 1 : 1;
      state.lastPracticeDate = today;
    }

    // Calculate XP earned
    let earned = Math.round(score * 0.5); // base: half the score
    if (score >= 90) earned += 20;        // excellence bonus
    if (score >= 95) earned += 15;        // near-perfect bonus
    if (state.streak >= 7) earned = Math.round(earned * 1.25); // streak multiplier

    // Track weak words
    if (wordDiff && Array.isArray(wordDiff)) {
      wordDiff.forEach(w => {
        if (w.status === 'missed' || w.status === 'wrong') {
          state.weakWords[w.word] = (state.weakWords[w.word] || 0) + 1;
        }
      });
    }

    // Update week XP
    if (state.weekStart !== getWeekStart()) {
      state.weekXP   = 0;
      state.weekStart = getWeekStart();
    }
    state.weekXP += earned;

    // Update overall stats
    state.xp += earned;
    state.totalAttempts++;
    state.scores.push(score);
    if (state.scores.length > 100) state.scores = state.scores.slice(-100);
    state.bestScore    = Math.max(state.bestScore, score);
    state.avgAccuracy  = Math.round(state.scores.reduce((a,b)=>a+b,0) / state.scores.length);

    // Level up check
    const oldLevel = state.level;
    const newLevel = calcLevel(state.xp);
    state.level    = newLevel;

    saveState(state);
    checkBadges(state);

    // Show XP toast
    showToast(`+${earned} XP earned!`, 'success');

    // Show level up modal if leveled up
    if (newLevel > oldLevel) {
      setTimeout(() => triggerLevelUp(newLevel), 800);
    }

    return { earned, newLevel, leveled: newLevel > oldLevel };
  },

  getStats() { return loadState(); },

  getLevel()  { return loadState().level; },
  getXP()     { return loadState().xp; },
  getStreak() { return loadState().streak; },
};

/* ── LEVEL CALC ──────────────────────────────────────────────────────────── */
function calcLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpMin) return LEVELS[i].level;
  }
  return 1;
}

function getLevelData(xp) {
  const level = calcLevel(xp);
  const info  = LEVELS.find(l => l.level === level) || LEVELS[0];
  const next  = LEVELS.find(l => l.level === level + 1);
  const pct   = next
    ? Math.round((xp - info.xpMin) / (info.xpMax - info.xpMin) * 100)
    : 100;
  return { level, info, next, pct, xpToNext: next ? info.xpMax - xp : 0 };
}

/* ── BADGE CHECK ─────────────────────────────────────────────────────────── */
function checkBadges(state) {
  BADGES.forEach(badge => {
    if (!state.earnedBadges.includes(badge.id) && badge.condition(state)) {
      state.earnedBadges.push(badge.id);
      saveState(state);
      setTimeout(() => showBadgeToast(badge), 1600);
    }
  });
}

function showBadgeToast(badge) {
  const old = document.querySelector('.badge-toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'badge-toast';
  el.innerHTML = `<span class="badge-toast-icon">${badge.icon}</span><div><div class="badge-toast-title">Badge Unlocked!</div><div class="badge-toast-label">${badge.label}</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

/* ── LEVEL UP MODAL ──────────────────────────────────────────────────────── */
function triggerLevelUp(level) {
  const overlay = document.getElementById('levelupOverlay');
  if (!overlay) return;
  const info = LEVELS.find(l => l.level === level);
  document.getElementById('levelupSub').textContent     = `Welcome to Level ${level} — ${info?.title || ''}`;
  document.getElementById('levelupUnlocked').textContent = info?.unlock ? '🔓 ' + info.unlock : '';
  overlay.classList.add('show');
  createConfetti();
}

window.closeLevelUp = function() {
  document.getElementById('levelupOverlay')?.classList.remove('show');
};

function createConfetti() {
  const burst = document.getElementById('levelupBurst');
  if (!burst) return;
  burst.innerHTML = '';
  const colors = ['#a78bfa','#f472b6','#34d399','#fbbf24','#60a5fa','#f87171'];
  for (let i = 0; i < 36; i++) {
    const d = document.createElement('div');
    d.className = 'confetti-piece';
    d.style.cssText = `
      left:${40+Math.random()*20}%;
      background:${colors[i%colors.length]};
      animation-delay:${Math.random()*0.4}s;
      animation-duration:${0.8+Math.random()*0.6}s;
      width:${6+Math.random()*6}px;
      height:${6+Math.random()*6}px;
      border-radius:${Math.random()>0.5?'50%':'2px'};
    `;
    burst.appendChild(d);
  }
}

/* ── DASHBOARD INIT ──────────────────────────────────────────────────────── */
window.initDashboard = function() {
  const state = loadState();
  const ld    = getLevelData(state.xp);

  // Level card
  document.getElementById('dashLevel').textContent = ld.level;
  document.getElementById('dashXP').textContent    = state.xp;
  document.getElementById('dashXPNext').textContent = ld.info.xpMax;
  document.getElementById('dashXPBar').style.width  = ld.pct + '%';
  document.getElementById('dashNextLabel').textContent =
    ld.next ? `${ld.xpToNext} XP to Level ${ld.next.level}` : 'Max level reached!';
  document.getElementById('levelRingPct').textContent = ld.pct + '%';

  // Ring animation
  const circle = document.getElementById('levelRingCircle');
  if (circle) {
    const circ = 2 * Math.PI * 24;
    setTimeout(() => {
      circle.style.strokeDashoffset = circ - (circ * ld.pct / 100);
    }, 300);
  }

  // Streak
  document.getElementById('dashStreak').textContent = state.streak;
  renderStreakDots(state.streak);

  // Stats
  document.getElementById('statAccuracy').textContent  = state.avgAccuracy ? state.avgAccuracy + '%' : '—';
  document.getElementById('statAttempts').textContent  = state.totalAttempts;
  document.getElementById('statBest').textContent      = state.bestScore || '—';
  document.getElementById('statWeekXP').textContent    = state.weekXP;

  // Lesson track
  renderLessonTrack(ld.level);

  // Weak words
  renderWeakWords(state.weakWords);

  // Activity
  renderActivity(state.scores);

  // Trend chart
  renderTrend(state.scores);

  // Badges
  renderBadges(state.earnedBadges);
};

function renderStreakDots(streak) {
  const el = document.getElementById('streakDots');
  if (!el) return;
  const days = ['M','T','W','T','F','S','S'];
  const today = new Date().getDay(); // 0=Sun
  const filled = Math.min(streak, 7);
  el.innerHTML = days.map((d, i) => `
    <div class="streak-dot ${i < filled ? 'filled' : ''}" title="${d}">${d}</div>`).join('');
}

function renderLessonTrack(userLevel) {
  const el = document.getElementById('lessonTrack');
  if (!el) return;
  el.innerHTML = LESSON_TRACK.map(lesson => {
    const locked = lesson.minLevel > userLevel;
    return `
      <div class="lesson-node ${locked ? 'locked' : ''}" onclick="${locked ? '' : `window.location.href='app.html'`}" title="${locked ? 'Unlocks at Level '+lesson.minLevel : lesson.desc}">
        <div class="lesson-node-icon">${locked ? '🔒' : lesson.icon}</div>
        <div class="lesson-node-title">${lesson.title}</div>
        ${locked ? `<div class="lesson-node-lock">Level ${lesson.minLevel}</div>` : ''}
      </div>`;
  }).join('<div class="lesson-connector"></div>');
}

function renderWeakWords(weakWords) {
  const el = document.getElementById('weakWordsList');
  if (!el) return;
  const sorted = Object.entries(weakWords).sort((a,b) => b[1]-a[1]).slice(0, 8);
  if (!sorted.length) return;
  const max = sorted[0][1];
  el.innerHTML = sorted.map(([word, count]) => `
    <div class="weak-word-row">
      <span class="weak-word-text">${word}</span>
      <div class="weak-word-bar-wrap">
        <div class="weak-word-bar" style="width:${Math.round(count/max*100)}%"></div>
      </div>
      <span class="weak-word-count">${count}x</span>
    </div>`).join('');
}

function renderActivity(scores) {
  const el = document.getElementById('activityList');
  if (!el) return;
  const recent = scores.slice(-6).reverse();
  if (!recent.length) return;
  el.innerHTML = recent.map((s, i) => {
    const icon = s >= 85 ? '🎯' : s >= 65 ? '📈' : '💪';
    const col  = s >= 85 ? 'var(--green)' : s >= 65 ? 'var(--amber)' : 'var(--red)';
    return `
      <div class="activity-item">
        <span>${icon}</span>
        <span style="flex:1;font-size:0.82rem;">Practice #${scores.length - i}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.88rem;font-weight:600;color:${col}">${s}/100</span>
      </div>`;
  }).join('');
}

function renderBadges(earnedIds) {
  const el = document.getElementById('profileBadges');
  if (!el) return;
  const earned = BADGES.filter(b => earnedIds.includes(b.id));
  el.innerHTML = earned.map(b =>
    `<span class="profile-badge" title="${b.label}: ${b.desc}">${b.icon}</span>`
  ).join('');
}

/* ── TREND CHART ─────────────────────────────────────────────────────────── */
function renderTrend(scores) {
  const canvas = document.getElementById('trendCanvas');
  const empty  = document.getElementById('trendEmpty');
  if (!canvas) return;
  if (scores.length < 3) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  canvas.style.display = 'block';

  const data = scores.slice(-20);
  const ctx  = canvas.getContext('2d');
  const W    = canvas.clientWidth || 600;
  const H    = canvas.clientHeight || 100;
  canvas.width  = W;
  canvas.height = H;

  const pad  = 20;
  const minV = 0, maxV = 100;
  const xStep = (W - pad*2) / Math.max(data.length - 1, 1);

  const pts = data.map((v, i) => ({
    x: pad + i * xStep,
    y: H - pad - ((v - minV) / (maxV - minV)) * (H - pad*2)
  }));

  // gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(167,139,250,0.3)');
  grad.addColorStop(1, 'rgba(167,139,250,0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, H);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // dots
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();
  });
}

/* ── APP.JS INTEGRATION — call after displayResults ─────────────────────── */
window.pfAwardAfterAttempt = function(score, wordDiff) {
  if (window.PF) window.PF.awardXP(score, wordDiff);
};

/* ── showToast fallback ──────────────────────────────────────────────────── */
if (typeof showToast === 'undefined') {
  window.showToast = function(msg, type='') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className   = 'toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  };
}
