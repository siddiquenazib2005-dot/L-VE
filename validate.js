function validate(req, res, next) {
  const { message } = req.body;

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "Message is required, Sir." });
  }

  // Sanitize inputs
  req.body.message   = message.trim();
  req.body.sessionId = String(req.body.sessionId || "default").slice(0, 64);
  req.body.mode      = ["assistant", "coder", "research"].includes(req.body.mode)
    ? req.body.mode : "assistant";

  next();
}

module.exports = validate;
