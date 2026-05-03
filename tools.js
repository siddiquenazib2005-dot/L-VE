// Tool patterns and handlers
const TOOLS = [
  {
    name: "time",
    match: /\b(what.?s the time|current time|time now|what time is it)\b/i,
    run: () => {
      const t = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
      return `The current time in India is **${t}**, Sir.`;
    },
  },
  {
    name: "date",
    match: /\b(what.?s the date|today.?s date|what day is it|what is today)\b/i,
    run: () => {
      const d = new Date().toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        timeZone: "Asia/Kolkata",
      });
      return `Today is **${d}**, Sir.`;
    },
  },
  {
    name: "calculator",
    match: /\b(calculate|compute|what is\s+[\d]|how much is\s+[\d]|\d+\s*[\+\-\*\/]\s*\d)\b/i,
    run: (msg) => {
      try {
        const expr = msg.match(/[\d\s\+\-\*\/\.\(\)]+/)?.[0]?.trim();
        if (!expr) return null;
        const result = Function(`"use strict"; return (${expr})`)();
        if (typeof result !== "number" || !isFinite(result)) return null;
        return `**${expr.trim()} = ${result}**, Sir.`;
      } catch (_) { return null; }
    },
  },
  {
    name: "weather",
    match: /\b(weather|forecast|temperature|rain|humidity)\b/i,
    run: () => `I don't have live weather data, Sir. Please check [weather.com](https://weather.com).`,
  },
  {
    name: "ping",
    match: /^\s*(hi|hello|hey|ping|yo)\s*[?!.]?\s*$/i,
    run: () => `Yes Sir, I'm fully online and at your service. 💝`,
  },
];

function execute(message) {
  for (const tool of TOOLS) {
    if (tool.match.test(message)) {
      const result = tool.run(message);
      if (result) return result;
    }
  }
  return null;
}

module.exports = { execute };
