/* ============================================================
   LOVE AI v2 — Complete Script
   ============================================================ */

// ── STATE ────────────────────────────────────────────────────
const S = {
  session:     'love_' + Date.now(),
  mode:        'assistant',
  busy:        false,
  tts:         false,
  chats:       [],
  history:     [],
  currentId:   null,
  recognition: null,
  synth:       window.speechSynthesis || null,
};

// ── DOM ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const msgInput    = $('msgInput');
const msgs        = $('msgs');
const sendBtn     = $('sendBtn');
const micBtn      = $('micBtn');
const voiceOverlay = $('voiceOverlay');
const welcome     = $('welcome');

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initStars();
  loadStorage();
  renderHistory();
  newChat();
  hideSplash();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
});

function hideSplash() {
  setTimeout(() => { const s = $('splash'); if (s) s.style.display = 'none'; }, 2800);
}

// ── STARS ────────────────────────────────────────────────────
function initStars() {
  const canvas = $('starsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.2 + 0.2,
    a: Math.random(),
    s: Math.random() * 0.003 + 0.001,
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(st => {
      st.a += st.s;
      if (st.a > 1 || st.a < 0) st.s = -st.s;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,180,255,${st.a * 0.6})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

// ── STORAGE ──────────────────────────────────────────────────
function loadStorage() {
  try { S.chats = JSON.parse(localStorage.getItem('lv2_chats') || '[]'); } catch (_) { S.chats = []; }
}
function saveStorage() {
  try { localStorage.setItem('lv2_chats', JSON.stringify(S.chats.slice(0, 40))); } catch (_) {}
}

// ── CHAT SESSIONS ────────────────────────────────────────────
function newChat() {
  if (S.history.length) persistChat();
  S.history   = [];
  S.session   = 'love_' + Date.now();
  S.currentId = S.session;
  msgs.innerHTML = '';
  if (welcome) welcome.style.display = 'flex';
  msgInput.value = '';
  msgInput.style.height = 'auto';
}

function persistChat() {
  const first = S.history.find(m => m.role === 'user');
  if (!first) return;
  const rec = { id: S.currentId, title: first.content.slice(0, 42), time: fmtTime(new Date()), msgs: [...S.history] };
  const idx  = S.chats.findIndex(c => c.id === S.currentId);
  if (idx >= 0) S.chats[idx] = rec;
  else S.chats.unshift(rec);
  saveStorage();
  renderHistory();
}

function loadChat(id) {
  const c = S.chats.find(x => x.id === id);
  if (!c) return;
  persistChat();
  S.history   = [...c.msgs];
  S.session   = c.id;
  S.currentId = c.id;
  msgs.innerHTML = '';
  if (welcome) welcome.style.display = 'none';
  S.history.forEach(m => renderMsg(m.role, m.content));
  closeSidebar();
}

// ── HISTORY SIDEBAR ───────────────────────────────────────────
function renderHistory(q = '') {
  const list = $('historyList');
  if (!list) return;
  const filtered = S.chats.filter(c => c.title.toLowerCase().includes(q.toLowerCase()));
  if (!filtered.length) { list.innerHTML = '<div style="padding:10px 10px;font-size:12px;color:var(--text3)">No chats yet, Sir.</div>'; return; }

  const now  = new Date().toDateString();
  const yest = new Date(Date.now() - 86400000).toDateString();
  const grps = { Today: [], Yesterday: [], Older: [] };
  filtered.forEach(c => {
    const d = new Date(+c.id.split('_')[1]).toDateString();
    if (d === now) grps.Today.push(c);
    else if (d === yest) grps.Yesterday.push(c);
    else grps.Older.push(c);
  });

  list.innerHTML = Object.entries(grps).map(([lbl, arr]) => {
    if (!arr.length) return '';
    return `<div class="hist-label">${lbl}</div>` + arr.map(c => `
      <div class="hist-item${c.id === S.currentId ? ' active' : ''}" onclick="loadChat('${c.id}')">
        <span class="hist-title">${esc(c.title)}</span>
        <span class="hist-time">${c.time}</span>
      </div>`).join('');
  }).join('');
}

// ── MODE ─────────────────────────────────────────────────────
function setMode(btn) {
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  S.mode = btn.dataset.mode;
  showToast('Mode: ' + btn.dataset.mode.charAt(0).toUpperCase() + btn.dataset.mode.slice(1));
}

// ── SEND ─────────────────────────────────────────────────────
async function sendMsg() {
  const text = msgInput.value.trim();
  if (!text || S.busy) return;

  if (welcome) welcome.style.display = 'none';
  S.busy = true;
  sendBtn.disabled = true;
  msgInput.value = '';
  msgInput.style.height = 'auto';

  S.history.push({ role: 'user', content: text });
  renderMsg('user', text);

  const typingEl = renderTyping();

  try {
    const res  = await fetch('/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: text, sessionId: S.session, mode: S.mode }),
    });
    const data = await res.json();
    typingEl.remove();

    const reply = data.reply || data.error || 'Something went wrong, Sir.';
    S.history.push({ role: 'assistant', content: reply });
    if (S.history.length > 40) S.history = S.history.slice(-40);

    await streamMsg(reply);
    persistChat();
    if (S.tts) speak(reply);

  } catch (e) {
    typingEl.remove();
    renderMsg('ai', 'A connection error occurred, Sir. Please check your network and try again.');
  } finally {
    S.busy = false;
    sendBtn.disabled = false;
    msgInput.focus();
    scrollBottom();
  }
}

// ── RENDER MESSAGE ────────────────────────────────────────────
function renderMsg(role, content) {
  const row  = document.createElement('div');
  row.className = 'msg-row ' + role;
  const tick = role === 'user' ? '<span class="tick">✓✓</span>' : '';
  row.innerHTML = `
    <div class="msg-av">${role === 'ai' ? '🤖' : '👤'}</div>
    <div class="msg-body">
      <div class="bubble"><div class="bubble-text">${role === 'user' ? esc(content) : md(content)}</div></div>
      <div class="msg-time">${fmtTime(new Date())} ${tick}</div>
    </div>`;
  if (role === 'ai') addCopyBtns(row);
  msgs.appendChild(row);
  scrollBottom();
  return row;
}

function renderTyping() {
  const row = document.createElement('div');
  row.className = 'typing-row';
  row.innerHTML = `
    <div class="msg-av" style="background:linear-gradient(135deg,var(--violet2),var(--indigo));border-radius:50%;box-shadow:0 0 10px var(--glow2)">🤖</div>
    <div class="typing-bubble">
      <span class="typing-label">Thinking</span>
      <div class="tdots"><span></span><span></span><span></span></div>
    </div>`;
  msgs.appendChild(row);
  scrollBottom();
  return row;
}

async function streamMsg(text) {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.innerHTML = `
    <div class="msg-av" style="background:linear-gradient(135deg,var(--violet2),var(--indigo));border-radius:50%;box-shadow:0 0 10px var(--glow2)">🤖</div>
    <div class="msg-body">
      <div class="bubble"><div class="bubble-text"></div></div>
      <div class="msg-time">${fmtTime(new Date())}</div>
    </div>`;
  msgs.appendChild(row);
  scrollBottom();

  const el    = row.querySelector('.bubble-text');
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    await sleep(16);
    el.innerHTML = md(words.slice(0, i + 1).join(' '));
    scrollBottom();
  }
  el.innerHTML = md(text);
  addCopyBtns(row);
  scrollBottom();
}

function addCopyBtns(container) {
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const b = document.createElement('button');
    b.className = 'copy-btn'; b.textContent = 'Copy';
    b.onclick = () => {
      navigator.clipboard.writeText(pre.querySelector('code')?.textContent || pre.textContent);
      b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy', 2000);
    };
    pre.appendChild(b);
  });
}

// ── CLEAR ────────────────────────────────────────────────────
function clearChat() {
  S.history = [];
  msgs.innerHTML = '';
  if (welcome) welcome.style.display = 'flex';
  fetch('/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: S.session }) }).catch(() => {});
  showToast('Memory cleared, Sir.');
}

// ── SIDEBAR ──────────────────────────────────────────────────
function toggleSidebar() { $('sidebar').classList.toggle('open'); $('sbOverlay').classList.toggle('show'); }
function closeSidebar()  { $('sidebar').classList.remove('open'); $('sbOverlay').classList.remove('show'); }

// ── VOICE INPUT ───────────────────────────────────────────────
function toggleMic() { S.isListening ? stopMic() : startMic(); }

function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Voice not supported on this browser, Sir.'); return; }
  if (!S.recognition) {
    S.recognition = new SR();
    S.recognition.continuous     = false;
    S.recognition.interimResults = false;
    S.recognition.lang           = 'en-IN';
    S.recognition.onresult = e => { msgInput.value = e.results[0][0].transcript; stopMic(); setTimeout(sendMsg, 300); };
    S.recognition.onerror  = () => stopMic();
    S.recognition.onend    = () => { S.isListening = false; micBtn.classList.remove('active'); voiceOverlay.classList.remove('show'); };
  }
  S.isListening = true;
  micBtn.classList.add('active');
  voiceOverlay.classList.add('show');
  S.recognition.start();
}

function stopMic() {
  if (S.recognition) S.recognition.stop();
  S.isListening = false;
  micBtn.classList.remove('active');
  voiceOverlay.classList.remove('show');
}

// ── TTS ───────────────────────────────────────────────────────
function toggleTTS() {
  S.tts = !S.tts;
  const btn = $('ttsBtn');
  if (btn) { btn.classList.toggle('active', S.tts); }
  showToast(S.tts ? 'Voice output ON, Sir.' : 'Voice output OFF.');
  if (!S.tts && S.synth) S.synth.cancel();
}

function speak(text) {
  if (!S.synth || !S.tts) return;
  S.synth.cancel();
  const clean = text.replace(/[#*`_~\[\]()]/g, '').replace(/\n/g, ' ').slice(0, 500);
  const utt   = new SpeechSynthesisUtterance(clean);
  utt.rate = 0.95; utt.pitch = 1.05; utt.volume = 1;
  const v = S.synth.getVoices().find(v => v.name.includes('Google') || v.lang === 'en-US');
  if (v) utt.voice = v;
  S.synth.speak(utt);
}

// ── THEME ────────────────────────────────────────────────────
function toggleTheme() { showToast('Light theme coming soon, Sir.'); }

// ── CHIPS ────────────────────────────────────────────────────
function useChip(el) { msgInput.value = el.textContent; sendMsg(); }

// ── BOTTOM NAV ────────────────────────────────────────────────
function navClick(btn) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  if (tab === 'voice')   startMic();
  if (tab === 'history') toggleSidebar();
  if (tab === 'settings') showToast('Settings coming soon, Sir.');
  if (tab === 'chat')    closeSidebar();
}

// ── UTILS ────────────────────────────────────────────────────
function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }

function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

function scrollBottom() { requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; }); }

function fmtTime(d) { return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
}

function md(text) {
  if (!text) return '';
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, l, c) => `<pre><code class="lang-${l||'text'}">${esc(c.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function showToast(msg) {
  let t = $('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}
