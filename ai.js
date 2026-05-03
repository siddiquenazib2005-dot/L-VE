const axios   = require("axios");
const config  = require("../config/index");
const logger  = require("../utils/logger");

async function chat(messages) {
  const response = await axios.post(
    config.GROQ_URL,
    {
      model:       config.MODEL,
      messages:    messages,
      temperature: config.TEMPERATURE,
      max_tokens:  config.MAX_TOKENS,
    },
    {
      headers: {
        "Authorization": "Bearer " + config.API_KEY,
        "Content-Type":  "application/json",
      },
      timeout: 30000,
    }
  );

  const reply = response.data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Empty response from Groq API");
  return reply;
}

module.exports = { chat };
