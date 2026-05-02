/* ============================================================
   LOVE AI — Main Script
   Features: API chat, localStorage memory, voice I/O,
             streaming effect, PWA, markdown rendering
   ============================================================ */

// ── CONFIG ───────────────────────────────────────────────────
const CONFIG = {
  API_ENDPOINT: "/chat",           // Your backend /chat endpoint
  MAX_HISTORY:  20,                // Max messages to keep in memory
  STREAM_SPEED: 18,                // ms per word in streaming effect
  APP_NAME:     "LOVE AI",
};

// ── STATE ────────────────────────────────────────────────────
let state = {
  sessionId:    "session_" + Date.now(),
  mode:         "assistant",
  isLoading:    false,
  isListening:  false,
  isSpeaking:   false,
  history:      [],                // Full chat history array
  chats:        [],                // Sidebar chat sessions
  currentChatId: null,
  recognition:  null,
  synth:        window.speechSynthesis || null,
};

// ── DOM REFS ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const dom = {
  splash:         $("splash"),
  messageInput:   $("messageInput"),
  messagesWrap:   $("messagesWrap"),
  sendBtn:        $("sendBtn"),
  micBtn:         $("micBtn"),
  clearBtn:       $("clearBtn"),
  menuBtn:        $("menuBtn"),
  sidebar:        $("sidebar"),
  sidebarOverlay: $("sidebarOverlay"),
  newChatBtn:     $("newChatBtn"),
  historyList:    $("historyList"),
  voiceOverlay:   $("voiceOverlay"),
  voiceStopBtn:   $("voiceStopBtn"),
  searchInput:    $("searchInput"),
  ttsBtn:         $("ttsBtn"),
  welcomeScreen:  $("welcomeScreen"),
};

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadChatsFromStorage();
  renderHistorySidebar();
  startNewChat();
  setupEventListeners();
  registerServiceWorker();
  hideSplash();
});

function hideSplash() {
  setTimeout(() => {
    if (dom.splash) dom.splash.style.display = "none";
  }, 2600);
}

// ── SERVICE WORKER ────────────────────────────────────────────
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
}

// ── EVENT LISTENERS ───────────────────────────────────────────
function setupEventListeners() {
  // Send on click
  dom.sendBtn.addEventListener("click", handleSend);

  // Send on Enter (Shift+Enter = new line)
  dom.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  dom.messageInput.addEventListener("input", () => {
    dom.messageInput.style.height = "auto";
    dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 120) + "px";
  });

  // Mic
  dom.micBtn.addEventListener("click", toggleVoiceInput);

  // Clear memory
  dom.clearBtn.addEventListener("click", clearCurrentChat);

  // Sidebar toggle
  dom.menuBtn.addEventListener("click", toggleSidebar);
  dom.sidebarOverlay.addEventListener("click", closeSidebar);

  // New chat
  dom.newChatBtn.addEventListener("click", () => { startNewChat(); closeSidebar(); });

  // Voice overlay stop
  dom.voiceStopBtn.addEventListener("click", stopVoiceInput);

  // TTS toggle
  if (dom.ttsBtn) dom.ttsBtn.addEventListener("click", toggleTTS);

  // Search history
  if (dom.searchInput) {
    dom.searchInput.addEventListener("input", () => renderHistorySidebar(dom.searchInput.value));
  }

  // Suggestion chips
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      dom.messageInput.value = chip.textContent;
      handleSend();
    });
  });

  // Bottom nav
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      const target = item.dataset.nav;
      if (target === "chat")     { closeSidebar(); }
      if (target === "voice")    { startVoiceInput(); }
      if (target === "history")  { toggleSidebar(); }
      if (target === "settings") { showToast("Settings coming soon, Sir."); }
    });
  });
}

// ── CHAT SESSIONS ────────────────────────────────────────────
function startNewChat() {
  // Save current chat if it has messages
  if (state.history.length > 0) saveCurrentChat();

  state.history      = [];
  state.sessionId    = "session_" + Date.now();
  state.currentChatId = state.sessionId;

  // Clear messages area and show welcome
  dom.messagesWrap.innerHTML = "";
  if (dom.welcomeScreen) {
    dom.welcomeScreen.style.display = "flex";
  }
  dom.messageInput.value = "";
  dom.messageInput.style.height = "auto";
}

function saveCurrentChat() {
  if (state.history.length === 0) return;
  const firstMsg = state.history.find(m => m.role === "user");
  const title    = firstMsg ? firstMsg.content.slice(0, 40) : "New Chat";
  const chat = {
    id:        state.currentChatId,
    title,
    time:      formatTime(new Date()),
    messages:  [...state.history],
  };
  // Update or add
  const idx = state.chats.findIndex(c => c.id === state.currentChatId);
  if (idx >= 0) state.chats[idx] = chat;
  else state.chats.unshift(chat);
  // Keep last 30 chats
  if (state.chats.length > 30) state.chats = state.chats.slice(0, 30);
  saveChatsToStorage();
  renderHistorySidebar();
}

function loadChat(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  saveCurrentChat();
  state.history      = [...chat.messages];
  state.sessionId    = chat.id;
  state.currentChatId = chat.id;
  renderAllMessages();
  closeSidebar();
}

// ── STORAGE ──────────────────────────────────────────────────
function saveChatsToStorage() {
  try { localStorage.setItem("love_ai_chats", JSON.stringify(state.chats)); } catch (_) {}
}
function loadChatsFromStorage() {
  try {
    const raw = localStorage.getItem("love_ai_chats");
    if (raw) state.chats = JSON.parse(raw);
  } catch (_) { state.chats = []; }
}

// ── HISTORY SIDEBAR ───────────────────────────────────────────
function renderHistorySidebar(filter = "") {
  if (!dom.historyList) return;
  const filtered = state.chats.filter(c =>
    c.title.toLowerCase().includes(filter.toLowerCase())
  );
  if (filtered.length === 0) {
    dom.historyList.innerHTML = `<div style="padding:12px 10px;font-size:12px;color:var(--text-3);">No chats yet, Sir.</div>`;
    return;
  }

  // Group by Today / Yesterday / Older
  const now      = new Date();
  const todayStr = now.toDateString();
  const yestStr  = new Date(now - 86400000).toDateString();

  const groups = { Today: [], Yesterday: [], Older: [] };
  filtered.forEach(c => {
    const d = new Date(parseInt(c.id.split("_")[1])).toDateString();
    if (d === todayStr) groups.Today.push(c);
    else if (d === yestStr) groups.Yesterday.push(c);
    else groups.Older.push(c);
  });

  let html = "";
  for (const [label, chats] of Object.entries(groups)) {
    if (!chats.length) continue;
    html += `<div class="history-label">${label}</div>`;
    chats.forEach(c => {
      const active = c.id === state.currentChatId ? "active" : "";
      html += `
        <div class="history-item ${active}" onclick="loadChat('${c.id}')">
          <span class="history-title">${escapeHTML(c.title)}</span>
          <span class="history-time">${c.time}</span>
        </div>`;
    });
  }
  dom.historyList.innerHTML = html;
}

// ── SEND MESSAGE ──────────────────────────────────────────────
async function handleSend() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isLoading) return;

  // Hide welcome
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = "none";

  // Add user message to UI + history
  addMessageToUI("user", text);
  state.history.push({ role: "user", content: text });

  // Clear input
  dom.messageInput.value = "";
  dom.messageInput.style.height = "auto";

  // Show typing
  const typingEl = addTypingIndicator();

  state.isLoading = true;
  dom.sendBtn.disabled = true;

  try {
    const reply = await fetchAIReply(text);
    typingEl.remove();
    const msgEl = addMessageToUI("ai", "");
    await streamText(msgEl.querySelector(".bubble-text"), reply);
    state.history.push({ role: "assistant", content: reply });
    // Trim history
    if (state.history.length > CONFIG.MAX_HISTORY * 2) {
      state.history = state.history.slice(-CONFIG.MAX_HISTORY * 2);
    }
    saveCurrentChat();
    // TTS
    if (state.ttsEnabled) speakText(reply);
  } catch (err) {
    typingEl.remove();
    addMessageToUI("ai", "Forgive me, Sir — " + (err.message || "an error occurred. Please try again."));
  } finally {
    state.isLoading = false;
    dom.sendBtn.disabled = false;
    scrollToBottom();
  }
}

// ── API CALL ──────────────────────────────────────────────────
async function fetchAIReply(message) {
  const res = await fetch(CONFIG.API_ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      message,
      sessionId: state.sessionId,
      mode:      state.mode,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Server error " + res.status);
  }
  const data = await res.json();
  return data.reply || "No response received, Sir.";
}

// ── RENDER MESSAGES ───────────────────────────────────────────
function addMessageToUI(role, content) {
  const time = formatTime(new Date());
  const wrap = document.createElement("div");
  wrap.className = `msg-row ${role}`;

  const avatarHtml = role === "ai"
    ? `<div class="msg-avatar">🤖</div>`
    : `<div class="msg-avatar">👤</div>`;

  const tickHtml = role === "user" ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12l7 7L23 4" stroke="#a78bfa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : "";

  wrap.innerHTML = `
    ${avatarHtml}
    <div class="msg-body">
      <div class="bubble">
        <div class="bubble-text">${role === "user" ? escapeHTML(content) : renderMarkdown(content)}</div>
      </div>
      <div class="msg-time">${time} ${tickHtml}</div>
    </div>`;

  dom.messagesWrap.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function renderAllMessages() {
  dom.messagesWrap.innerHTML = "";
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = "none";
  state.history.forEach(msg => addMessageToUI(msg.role, msg.content));
}

function addTypingIndicator() {
  const el = document.createElement("div");
  el.className = "msg-row ai";
  el.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="typing-indicator">
        <span class="typing-text">Thinking</span>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
  dom.messagesWrap.appendChild(el);
  scrollToBottom();
  return el;
}

// ── STREAMING EFFECT ──────────────────────────────────────────
async function streamText(el, text) {
  el.innerHTML = "";
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    await sleep(CONFIG.STREAM_SPEED);
    // Re-render markdown progressively
    el.innerHTML = renderMarkdown(words.slice(0, i + 1).join(" "));
    scrollToBottom();
  }
  // Final render with full markdown + code copy buttons
  el.innerHTML = renderMarkdown(text);
  addCopyButtons(el);
  scrollToBottom();
}

function addCopyButtons(container) {
  container.querySelectorAll("pre").forEach(pre => {
    if (pre.querySelector(".copy-code-btn")) return;
    const btn = document.createElement("button");
    btn.className = "copy-code-btn";
    btn.textContent = "Copy";
    btn.onclick = () => {
      const code = pre.querySelector("code");
      navigator.clipboard.writeText(code ? code.textContent : pre.textContent);
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 2000);
    };
    pre.appendChild(btn);
  });
}

// ── MARKDOWN RENDERER ─────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    // Code blocks
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang||'text'}">${escapeHTML(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,  "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,   "<h1>$1</h1>")
    // Bullet lists
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  return `<p>${html}</p>`;
}

// ── VOICE INPUT ───────────────────────────────────────────────
function toggleVoiceInput() {
  if (state.isListening) stopVoiceInput();
  else startVoiceInput();
}

function startVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast("Voice input not supported on this browser, Sir."); return; }

  if (!state.recognition) {
    state.recognition = new SR();
    state.recognition.continuous     = false;
    state.recognition.interimResults = false;
    state.recognition.lang           = "en-IN";

    state.recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      dom.messageInput.value = transcript;
      stopVoiceInput();
      setTimeout(handleSend, 300);
    };
    state.recognition.onerror = () => stopVoiceInput();
    state.recognition.onend   = () => {
      state.isListening = false;
      dom.micBtn.classList.remove("listening");
      dom.voiceOverlay.classList.remove("show");
    };
  }

  state.isListening = true;
  dom.micBtn.classList.add("listening");
  dom.voiceOverlay.classList.add("show");
  state.recognition.start();
}

function stopVoiceInput() {
  if (state.recognition) state.recognition.stop();
  state.isListening = false;
  dom.micBtn.classList.remove("listening");
  dom.voiceOverlay.classList.remove("show");
}

// ── TEXT TO SPEECH ────────────────────────────────────────────
state.ttsEnabled = false;

function toggleTTS() {
  state.ttsEnabled = !state.ttsEnabled;
  if (dom.ttsBtn) {
    dom.ttsBtn.style.color = state.ttsEnabled ? "var(--violet-light)" : "";
    dom.ttsBtn.style.borderColor = state.ttsEnabled ? "var(--violet)" : "";
  }
  showToast(state.ttsEnabled ? "Voice output ON, Sir." : "Voice output OFF.");
  if (!state.ttsEnabled && state.synth) state.synth.cancel();
}

function speakText(text) {
  if (!state.synth || !state.ttsEnabled) return;
  state.synth.cancel();
  // Strip markdown for TTS
  const clean = text.replace(/[#*`_~\[\]()]/g, "").replace(/\n/g, " ").slice(0, 500);
  const utt   = new SpeechSynthesisUtterance(clean);
  utt.rate    = 0.95;
  utt.pitch   = 1.05;
  utt.volume  = 1;
  // Pick a nice voice if available
  const voices = state.synth.getVoices();
  const pref   = voices.find(v => v.name.includes("Google") || v.name.includes("Samantha") || v.lang === "en-US");
  if (pref) utt.voice = pref;
  state.synth.speak(utt);
}

// ── CLEAR CHAT ────────────────────────────────────────────────
function clearCurrentChat() {
  state.history = [];
  dom.messagesWrap.innerHTML = "";
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = "flex";
  fetch("/clear", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ sessionId: state.sessionId }),
  }).catch(() => {});
  showToast("Memory cleared, Sir.");
}

// ── SIDEBAR ───────────────────────────────────────────────────
function toggleSidebar() {
  dom.sidebar.classList.toggle("open");
  dom.sidebarOverlay.classList.toggle("show");
}
function closeSidebar() {
  dom.sidebar.classList.remove("open");
  dom.sidebarOverlay.classList.remove("show");
}

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:rgba(124,58,237,0.9);color:#fff;padding:10px 20px;border-radius:20px;
      font-size:13px;z-index:9999;backdrop-filter:blur(10px);
      border:1px solid rgba(167,139,250,0.3);white-space:nowrap;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = "0"; }, 2500);
}

// ── UTILS ─────────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

function formatTime(date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.messagesWrap.scrollTop = dom.messagesWrap.scrollHeight;
  });
    }
    
