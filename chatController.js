const ai      = require("../services/ai");
const memory  = require("../services/memory");
const tools   = require("../services/tools");
const PROMPTS = require("../utils/prompts");
const logger  = require("../utils/logger");

// POST /chat
async function handleChat(req, res) {
  const { message, sessionId, mode } = req.body;

  try {
    logger.info(`[${sessionId}] mode=${mode} → "${message.slice(0, 50)}"`);

    // 1. Try tool first (instant response)
    const toolReply = tools.execute(message);
    if (toolReply) {
      memory.save(sessionId, message, toolReply);
      logger.ok(`[${sessionId}] Tool responded`);
      return res.json({ reply: toolReply, sessionId, mode, source: "tool" });
    }

    // 2. Build messages with history + system prompt
    const history  = memory.get(sessionId);
    const messages = [
      { role: "system", content: PROMPTS[mode] || PROMPTS.assistant },
      ...history,
      { role: "user",   content: message },
    ];

    // 3. Call Groq AI
    const reply = await ai.chat(messages);

    // 4. Save to memory
    memory.save(sessionId, message, reply);
    logger.ok(`[${sessionId}] AI responded`);

    return res.json({ reply, sessionId, mode, source: "ai" });

  } catch (err) {
    logger.error(`[${sessionId}] ${err.message}`);
    return res.status(500).json({
      error: "Forgive me, Sir — an error occurred. Please try again.",
    });
  }
}

// POST /clear
function handleClear(req, res) {
  const { sessionId = "default" } = req.body;
  memory.clear(sessionId);
  logger.info(`[${sessionId}] Memory cleared`);
  res.json({ ok: true, message: "Memory cleared, Sir." });
}

module.exports = { handleChat, handleClear };
