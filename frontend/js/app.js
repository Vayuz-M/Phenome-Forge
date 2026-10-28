/* ══════════════════════════════════════════════════════════════════════════
   app.js — Phoneme Forge Main Application
   Handles: sentence loading, microphone recording, waveform animation,
            API calls, score rendering, feedback display, session history.
══════════════════════════════════════════════════════════════════════════ */

/* ── STATE ───────────────────────────────────────────────────────────────── */
let mediaRecorder   = null;
let audioChunks     = [];
let recordingStream = null;
let isRecording     = false;
let sessionId       = null;
let timerInterval   = null;
let recordStart     = null;
let waveAnimFrame   = null;
let audioCtx        = null;
let analyserNode    = null;
let sourceNode      = null;

const history      = [];
const API_BASE     = '';   // same origin

let currentSentence = '';

/* ── DOM ─────────────────────────────────────────────────────────────────── */
const referenceText   = () => document.getElementById('referenceText');
const micBtn          = () => document.getElementById('micBtn');
const startBtn        = () => document.getElementById('startBtn');
const stopBtn         = () => document.getElementById('stopBtn');
const statusDot       = () => document.getElementById('statusDot');
const statusText      = () => document.getElementById('statusText');
const recordTimer     = () => document.getElementById('recordTimer');
const waveCanvas      = () => document.getElementById('waveformCanvas');
const scorePanel      = () => document.getElementById('scorePanel');
const analyzingOverlay = () => document.getElementById('analyzingOverlay');

/* ── INIT ─────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadSentences();
  initWaveformIdle();
});

/* ── SENTENCES ─────────────────────────────────────────────────────────────── */
async function loadSentences() {
  try {
    const res  = await fetch(`${API_BASE}/api/reference-sentences`);
    const data = await res.json();
    renderSentences(data.sentences);
    selectSentence(data.sentences[0], 0);
  } catch {
    const fallback = [
      "Speech therapy helps people improve communication.",
      "The quick brown fox jumps over the lazy dog.",
      "She sells seashells by the seashore.",
    ];
    renderSentences(fallback);
    selectSentence(fallback[0], 0);
  }
}

function renderSentences(sentences) {
  const list = document.getElementById('sentenceList');
  list.innerHTML = sentences.map((s, i) => `
    <div class="sentence-item" id="sent-${i}" onclick="selectSentence('${s.replace(/'/g,"\\'")}', ${i})">
      ${s}
    </div>`).join('');
}

function selectSentence(text, idx) {
  currentSentence = text;
  referenceText().textContent = text;
  document.querySelectorAll('.sentence-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

window.useCustomSentence = function () {
  const val = document.getElementById('customSentence').value.trim();
  if (!val) { showToast('Please type a sentence first.', 'error'); return; }
  currentSentence = val;
  referenceText().textContent = val;
  document.querySelectorAll('.sentence-item').forEach(el => el.classList.remove('active'));
  showToast('Custom sentence set ✓', 'success');
};

/* ── WAVEFORM ─────────────────────────────────────────────────────────────── */
function initWaveformIdle() {
  const canvas = waveCanvas();
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let t = 0;

  function drawIdle() {
    canvas.width  = canvas.clientWidth;
    canvas.height = canvas.clientHeight || 64;
    const W = canvas.width, H = canvas.height, mid = H / 2;

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const y = mid + Math.sin((x / W) * Math.PI * 4 + t) * 3
                    + Math.sin((x / W) * Math.PI * 8 + t * 1.3) * 1.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(167,139,250,0.2)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    t += 0.04;
    waveAnimFrame = requestAnimationFrame(drawIdle);
  }
  cancelAnimationFrame(waveAnimFrame);
  drawIdle();
}

function drawLiveWaveform() {
  if (!analyserNode) return;
  const canvas = waveCanvas();
  if (!canvas) return;
  const ctx   = canvas.getContext('2d');
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight || 64;
  const W   = canvas.width, H = canvas.height;
  const buf = new Uint8Array(analyserNode.frequencyBinCount);

  function draw() {
    if (!isRecording) return;
    analyserNode.getByteTimeDomainData(buf);

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    const sliceW = W / buf.length;
    let x = 0;
    buf.forEach((v, i) => {
      const y = (v / 128.0) * H / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    });
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(167,139,250,0.5)';
    ctx.shadowBlur  = 8;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    waveAnimFrame = requestAnimationFrame(draw);
  }
  cancelAnimationFrame(waveAnimFrame);
  draw();
}

/* ── RECORDING ────────────────────────────────────────────────────────────── */
window.toggleRecording = function () {
  if (isRecording) stopRecording(); else startRecording();
};

window.startRecording = async function () {
  if (isRecording) return;
  if (!currentSentence) {
    showToast('Please select a reference sentence first.', 'error'); return;
  }

  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    showToast('Microphone access denied. Please allow microphone access.', 'error');
    return;
  }

  // Web Audio API for waveform
  audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 512;
  sourceNode  = audioCtx.createMediaStreamSource(recordingStream);
  sourceNode.connect(analyserNode);

  // MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

  mediaRecorder = new MediaRecorder(recordingStream, { mimeType });
  audioChunks   = [];
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = uploadAudio;
  mediaRecorder.start(100);

  isRecording = true;
  recordStart = Date.now();

  // UI
  micBtn().classList.add('recording');
  startBtn().disabled = true;
  stopBtn().disabled  = false;
  statusDot().className = 'status-dot live';
  statusText().textContent = 'Recording… speak the sentence above';

  // Timer
  timerInterval = setInterval(() => {
    const s = ((Date.now() - recordStart) / 1000).toFixed(1);
    recordTimer().textContent = `${s}s`;
  }, 100);

  drawLiveWaveform();
};

window.stopRecording = function () {
  if (!isRecording) return;
  isRecording = false;
  clearInterval(timerInterval);
  recordTimer().textContent = '';
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (recordingStream) recordingStream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();

  micBtn().classList.remove('recording');
  startBtn().disabled = false;
  stopBtn().disabled  = true;
  statusDot().className = 'status-dot';
  statusText().textContent = 'Processing…';

  cancelAnimationFrame(waveAnimFrame);
  initWaveformIdle();
};

/* ── UPLOAD + ANALYZE ─────────────────────────────────────────────────────── */
async function uploadAudio() {
  if (audioChunks.length === 0) {
    showToast('No audio recorded. Please try again.', 'error');
    return;
  }

  showAnalyzing(true);
  setAnalyzingStep('Uploading audio…');

  const blob     = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  if (sessionId) formData.append('session_id', sessionId);

  try {
    // Step 1: Upload
    const uploadRes = await fetch(`${API_BASE}/api/record-audio`, {
      method: 'POST', body: formData,
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    sessionId = uploadData.session_id;

    // Step 2: Analyze
    setAnalyzingStep('Transcribing with Whisper…');
    await sleep(600);
    setAnalyzingStep('Calculating pronunciation score…');

    const analyzeForm = new FormData();
    analyzeForm.append('session_id', sessionId);
    analyzeForm.append('reference',  currentSentence);

    const analyzeRes = await fetch(`${API_BASE}/api/analyze-pronunciation`, {
      method: 'POST', body: analyzeForm,
    });
    if (!analyzeRes.ok) {
      const err = await analyzeRes.json().catch(() => ({}));
      throw new Error(err.detail || `Analysis failed: ${analyzeRes.status}`);
    }
    const result = await analyzeRes.json();

    setAnalyzingStep('Generating AI feedback…');
    await sleep(400);
    showAnalyzing(false);

    displayResults(result);
    addToHistory(result);

  } catch (e) {
    showAnalyzing(false);
    showToast(`Error: ${e.message}`, 'error');
    statusText().textContent = 'Error — please try again';
    statusDot().className = 'status-dot';
    console.error(e);
  }
}

/* ── DISPLAY RESULTS ─────────────────────────────────────────────────────── */
function displayResults(data) {
  const { scores, spoken_text, feedback, word_diff } = data;

  scorePanel().classList.add('show');
  scorePanel().scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Animate score counter
  animateCounter('scoreNum', 0, scores.total, 900);

  // Colour the big score
  const scoreEl = document.getElementById('scoreNum');
  setTimeout(() => {
    scoreEl.style.color = scoreColor(scores.total);
  }, 950);

  // Grade badge
  const grade = document.getElementById('scoreGrade');
  const { label, cls } = gradeInfo(scores.total);
  grade.textContent = label;
  grade.className   = 'score-grade ' + cls;

  // Sub-scores with bar animation
  setTimeout(() => {
    document.getElementById('scoreAccuracy').textContent    = scores.accuracy;
    document.getElementById('scoreFluency').textContent     = scores.fluency;
    document.getElementById('scoreCompleteness').textContent = scores.completeness;
    document.getElementById('barAccuracy').style.width    = scores.accuracy    + '%';
    document.getElementById('barFluency').style.width     = scores.fluency     + '%';
    document.getElementById('barCompleteness').style.width = scores.completeness + '%';
  }, 400);

  // Transcription
  document.getElementById('transcriptionText').textContent =
    spoken_text || '(no speech detected)';

  // Word diff
  const diffEl = document.getElementById('wordDiff');
  if (word_diff && word_diff.length > 0) {
    diffEl.innerHTML = word_diff.map(w => `
      <span class="word-chip chip-${w.status}">${w.word}</span>`).join('');
  } else {
    diffEl.innerHTML = '<span style="font-size:0.8rem;color:var(--text-4);font-family:\'JetBrains Mono\',monospace;">— word analysis unavailable —</span>';
  }

  // Format feedback text
  document.getElementById('feedbackText').innerHTML =
    formatFeedback(feedback || 'No feedback generated.');

  // Phoneme analysis
  renderPhonemePanel(word_diff, spoken_text, data.reference || currentSentence);

  // Award XP via gamification
  if (window.pfAwardAfterAttempt) {
    const result = window.pfAwardAfterAttempt(scores.total, word_diff);
    if (result) {
      const banner = document.getElementById('xpEarnedBanner');
      const xpText = document.getElementById('xpEarnedText');
      if (banner && xpText) {
        xpText.textContent = `+${result.earned} XP earned — Level ${result.newLevel}`;
        banner.style.display = 'flex';
      }
    }
  }

  statusDot().className    = 'status-dot done';
  statusText().textContent = `Scored ${scores.total}/100 — great effort!`;
}

function formatFeedback(text) {
  // Highlight sections
  return text
    .replace(/SUMMARY:/g,     '<strong style="color:var(--amber);">SUMMARY:</strong>')
    .replace(/STRENGTHS:/g,   '<strong style="color:var(--green);">STRENGTHS:</strong>')
    .replace(/IMPROVEMENTS:/g,'<strong style="color:var(--amber);">IMPROVEMENTS:</strong>')
    .replace(/PRACTICE TIP:/g,'<strong style="color:var(--blue);">PRACTICE TIP:</strong>')
    .replace(/✅/g, '<span style="color:var(--green)">✅</span>')
    .replace(/❌/g, '<span style="color:var(--red)">❌</span>');
}

function scoreColor(s) {
  if (s >= 85) return 'var(--green)';
  if (s >= 65) return 'var(--amber)';
  if (s >= 45) return '#fb923c';
  return 'var(--red)';
}

function gradeInfo(s) {
  if (s >= 90) return { label: 'Excellent 🌟', cls: 'grade-excellent' };
  if (s >= 75) return { label: 'Good 👍',      cls: 'grade-good' };
  if (s >= 55) return { label: 'Fair 📈',       cls: 'grade-fair' };
  return              { label: 'Keep Trying 💪', cls: 'grade-poor' };
}

function animateCounter(id, from, to, duration) {
  const el    = document.getElementById(id);
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── HISTORY ─────────────────────────────────────────────────────────────── */
function addToHistory(data) {
  history.unshift({
    score:    data.scores.total,
    sentence: currentSentence,
    spoken:   data.spoken_text,
    ts:       new Date().toLocaleTimeString(),
  });

  const list = document.getElementById('historyList');
  list.innerHTML = history.slice(0, 6).map(h => `
    <div class="history-item">
      <div class="history-score">${h.score}/100 <span style="color:var(--text-4);font-size:0.7rem;">— ${h.ts}</span></div>
      <div class="history-text">${h.sentence.slice(0, 48)}${h.sentence.length > 48 ? '…' : ''}</div>
    </div>`).join('');

  // Update stats
  const scores = history.map(h => h.score);
  document.getElementById('statAttempts').textContent = history.length;
  document.getElementById('statAvg').textContent      = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  document.getElementById('statBest').textContent     = Math.max(...scores);

  let streak = 0;
  for (const h of history) {
    if (h.score >= 70) streak++; else break;
  }
  document.getElementById('statStreak').textContent = streak + '🔥';
}

/* ── RESET ────────────────────────────────────────────────────────────────── */
window.resetForNextAttempt = function () {
  scorePanel().classList.remove('show');
  const pp = document.getElementById('phonemePanel');
  if (pp) pp.classList.remove('show');
  const xb = document.getElementById('xpEarnedBanner');
  if (xb) xb.style.display = 'none';
  statusDot().className    = 'status-dot';
  statusText().textContent = 'Ready — press record to try again';
  sessionId = null;
};

/* ── PHONEME PANEL RENDERER ──────────────────────────────────────────────── */
function renderPhonemePanel(wordDiff, spokenText, reference) {
  const panel = document.getElementById('phonemePanel');
  const words = document.getElementById('phonemeWords');
  if (!panel || !words) return;

  // Build per-word phoneme data
  const refWords = (reference || '').split(/\s+/).filter(Boolean);
  const spokenMap = {};
  if (wordDiff && Array.isArray(wordDiff)) {
    wordDiff.forEach(w => { spokenMap[w.word.toLowerCase()] = w.status; });
  }

  const phonemeMap = buildPhonemeMap();

  words.innerHTML = refWords.map(word => {
    const clean  = word.replace(/[^a-zA-Z']/g, '').toLowerCase();
    const status = spokenMap[clean] || (spokenMap[word.toLowerCase()] || 'correct');
    const ph     = phonemeMap[clean] || phonemeMap[word.toLowerCase()] || syllabize(clean);
    const statusLabel = status === 'correct' ? 'Correct ✓' : status === 'missed' ? 'Missing ✗' : 'Incorrect ✗';
    const badgeClass  = status === 'correct' ? 'badge-correct' : status === 'missed' ? 'badge-missing' : 'badge-wrong';
    const blockClass  = status === 'correct' ? 'correct' : status === 'missed' ? 'missing' : 'wrong';

    const phonemeHTML = ph.units.map(u => `
      <div class="phoneme-unit ${u.quality === 'ok' ? 'ph-ok' : u.quality === 'warn' ? 'ph-warn' : 'ph-bad'}">
        <span class="ph-text">${u.sound}</span>
        <span class="ph-status">${u.quality === 'ok' ? '✓' : u.quality === 'warn' ? '~' : '✗'}</span>
      </div>`).join('');

    const mistakeHTML = status !== 'correct' && ph.mistake
      ? `<div class="phoneme-mistake">${ph.mistake}</div>
         <div class="phoneme-correction">→ ${ph.correction}</div>`
      : '';

    return `
      <div class="phoneme-word-block ${blockClass}">
        <div class="phoneme-word-header">
          <span class="phoneme-word-text">${word}</span>
          <span class="phoneme-status-badge ${badgeClass}">${statusLabel}</span>
        </div>
        <div class="phoneme-breakdown">${phonemeHTML}</div>
        ${mistakeHTML}
      </div>`;
  }).join('');

  panel.classList.add('show');
}

function buildPhonemeMap() {
  // Common words with phoneme breakdowns for demonstration
  return {
    'speech':        { units:[{sound:'sp',quality:'ok'},{sound:'EE',quality:'ok'},{sound:'ch',quality:'ok'}], mistake:null, correction:null },
    'therapy':       { units:[{sound:'TH',quality:'ok'},{sound:'AIR',quality:'warn'},{sound:'uh',quality:'ok'},{sound:'pee',quality:'ok'}], mistake:'Stressed vowel "AIR" too short', correction:'THAIR-uh-pee' },
    'helps':         { units:[{sound:'h',quality:'ok'},{sound:'EH',quality:'ok'},{sound:'l',quality:'warn'},{sound:'ps',quality:'warn'}], mistake:'"lps" cluster compressed', correction:'hh-EH-l-ps' },
    'people':        { units:[{sound:'PEE',quality:'ok'},{sound:'pul',quality:'ok'}], mistake:null, correction:null },
    'improve':       { units:[{sound:'im',quality:'ok'},{sound:'PROOV',quality:'warn'}], mistake:'Long "oo" shortened', correction:'im-PROOV' },
    'communication': { units:[{sound:'kuh',quality:'ok'},{sound:'myoo',quality:'ok'},{sound:'nih',quality:'ok'},{sound:'KAY',quality:'ok'},{sound:'shun',quality:'ok'}], mistake:null, correction:null },
    'through':       { units:[{sound:'TH',quality:'warn'},{sound:'ROO',quality:'ok'}], mistake:'TH aspirated incorrectly', correction:'voiced TH + ROO' },
    'weather':       { units:[{sound:'WEH',quality:'ok'},{sound:'thur',quality:'warn'}], mistake:'Final schwa reduced', correction:'WEH-thur' },
    'rural':         { units:[{sound:'ROO',quality:'warn'},{sound:'rul',quality:'bad'}], mistake:'Double R difficult', correction:'ROO-rul' },
    'the':           { units:[{sound:'THUH',quality:'ok'}], mistake:null, correction:null },
    'quick':         { units:[{sound:'kw',quality:'ok'},{sound:'IK',quality:'ok'}], mistake:null, correction:null },
    'fox':           { units:[{sound:'f',quality:'ok'},{sound:'AW',quality:'ok'},{sound:'ks',quality:'ok'}], mistake:null, correction:null },
  };
}

function syllabize(word) {
  // Simple fallback syllabizer
  const vowels = 'aeiou';
  const parts  = [];
  let buf = '';
  for (const ch of word) {
    buf += ch;
    if (vowels.includes(ch) && buf.length > 1) {
      parts.push({ sound: buf.toUpperCase(), quality: 'ok' });
      buf = '';
    }
  }
  if (buf) parts.push({ sound: buf.toUpperCase(), quality: 'ok' });
  return { units: parts.length ? parts : [{ sound: word.toUpperCase(), quality: 'ok' }], mistake: null, correction: null };
}

/* ── LOADING ─────────────────────────────────────────────────────────────── */
function showAnalyzing(show) {
  analyzingOverlay().classList.toggle('show', show);
}

const steps = [
  'Uploading audio…',
  'Transcribing speech with Whisper…',
  'Calculating pronunciation score…',
  'Comparing phonetic patterns…',
  'Generating AI coaching feedback…',
];
let stepIndex = 0;

function setAnalyzingStep(msg) {
  document.getElementById('analyzingStep').textContent = msg;
}

/* ── UTILS ────────────────────────────────────────────────────────────────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// showToast defined in antigravity.js — re-export safety
if (typeof showToast === 'undefined') {
  window.showToast = function(msg, type = '') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className   = 'toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  };
}
