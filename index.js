require("dotenv").config();

const config = {
  PORT:       process.env.PORT                                  || 3000,
  API_KEY:    process.env.GROK_API_KEY || process.env.API_KEY  || "",
  MODEL:      process.env.MODEL                                 || "llama3-70b-8192",
  GROQ_URL:   "https://api.groq.com/openai/v1/chat/completions",
  RENDER_URL: process.env.RENDER_URL                           || "",
  MAX_TOKENS: 1024,
  TEMPERATURE: 0.7,
};

if (!config.API_KEY) {
  console.error("❌ FATAL: No API key found.");
  console.error("   Set GROK_API_KEY or API_KEY in Render → Environment Variables.");
  process.exit(1);
}

module.exports = config;
