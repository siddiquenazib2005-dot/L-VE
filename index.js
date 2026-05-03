require("dotenv").config();
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

if (!process.env.API_KEY) {
  console.error("FATAL: API_KEY not set. Render -> Environment -> Add API_KEY");
  process.exit(1);
}

const PORT       = process.env.PORT       || 3000;
const MODEL      = process.env.MODEL      || "llama3-70b-8192";
const RENDER_URL = process.env.RENDER_URL || "";

const PROMPTS = {
  assistant: "You are Love, an emotionally intelligent AI assistant. Always address the user as Sir. Be calm, warm, smart, and helpful. Use Markdown when it adds clarity.",
  coder:     "You are Love in Coder Mode, an elite software engineer. Always address the user as Sir. Write clean efficient code. Always use Markdown code blocks with language tags.",
  research:  "You are Love in Research Mode, a brilliant analyst. Always address the user as Sir. Think critically and structure answers with Markdown headers and bullet points."
};

const sessions = {};

function getHistory(sid) {
  if (!sessions[sid]) sessions[sid] = [];
  return sessions[sid];
}

function saveHistory(sid, userMsg, aiMsg) {
  const h = getHistory(sid);
  h.push({ role: "user",      content: userMsg });
  h.push({ role: "assistant", content: aiMsg   });
  if (h.length > 40) sessions[sid] = h.slice(-40);
}

function runTool(msg) {
  if (/\b(what.?s the time|current time|time now)\b/i.test(msg)) {
    const t = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
    return "Current time in India is **" + t + "**, Sir.";
  }
  if (/\b(what.?s the date|today.?s date|what day)\b/i.test(msg)) {
    const d = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Kolkata" });
    return "Today is **" + d + "**, Sir.";
  }
  if (/\b(weather|forecast)\b/i.test(msg)) {
    return "I don't have live weather data right now, Sir. Please check weather.com.";
  }
  if (/^\s*(hi|hello|hey|ping)\s*[?!.]?\s*$/i.test(msg)) {
    return "Yes Sir, I'm fully online and at your service. 💝";
  }
  return null;
}

async function callAI(messages) {
  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    { model: MODEL, messages: messages, temperature: 0.7, max_tokens: 1024 },
    {
      headers: {
        "Authorization": "Bearer " + process.env.API_KEY,
        "Content-Type":  "application/json"
      },
      timeout: 30000
    }
  );
  const reply = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message && res.data.choices[0].message.content;
  if (!reply) throw new Error("Empty response from AI");
  return reply;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/chat", async function(req, res) {
  try {
    var message   = (req.body.message   || "").trim();
    var sessionId = (req.body.sessionId || "default").toString();
    var mode      = ["assistant","coder","research"].includes(req.body.mode) ? req.body.mode : "assistant";

    if (!message) {
      return res.status(400).json({ error: "Message is required, Sir." });
    }

    var toolReply = runTool(message);
    if (toolReply) {
      saveHistory(sessionId, message, toolReply);
      return res.json({ reply: toolReply, sessionId: sessionId, mode: mode, source: "tool" });
    }

    var messages = [{ role: "system", content: PROMPTS[mode] }].concat(getHistory(sessionId)).concat([{ role: "user", content: message }]);
    var reply = await callAI(messages);
    saveHistory(sessionId, message, reply);
    return res.json({ reply: reply, sessionId: sessionId, mode: mode, source: "ai" });

  } catch (err) {
    console.error("/chat error:", err.message);
    return res.status(500).json({ error: "Forgive me, Sir, an error occurred. Please try again." });
  }
});

app.post("/clear", function(req, res) {
  var sid = (req.body.sessionId || "default").toString();
  delete sessions[sid];
  res.json({ ok: true });
});

app.get("/health", function(req, res) {
  res.json({ status: "ok", uptime: Math.floor(process.uptime()) + "s" });
});

app.get("/", function(req, res) {
  var p = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(p)) return res.sendFile(p);
  res.json({ message: "LOVE AI is online, Sir.", status: "running" });
});

app.use(function(err, req, res, next) {
  console.error("unhandled:", err.message);
  res.status(500).json({ error: "Internal error, Sir." });
});

if (RENDER_URL) {
  setInterval(function() {
    axios.get(RENDER_URL + "/health").catch(function() {});
  }, 600000);
}

app.listen(PORT, function() {
  console.log("LOVE AI running on port " + PORT);
});
                                                                                                     
