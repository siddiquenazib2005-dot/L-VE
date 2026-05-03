// In-memory session store — persists for lifetime of server process
const store = {};
const MAX   = 20; // max message pairs per session

function get(sessionId) {
  if (!store[sessionId]) store[sessionId] = [];
  return store[sessionId];
}

function save(sessionId, userMsg, aiMsg) {
  const h = get(sessionId);
  h.push({ role: "user",      content: userMsg });
  h.push({ role: "assistant", content: aiMsg   });
  // Trim oldest messages when limit exceeded
  if (h.length > MAX * 2) store[sessionId] = h.slice(-(MAX * 2));
}

function clear(sessionId) {
  delete store[sessionId];
}

function count() {
  return Object.keys(store).length;
}

module.exports = { get, save, clear, count };
