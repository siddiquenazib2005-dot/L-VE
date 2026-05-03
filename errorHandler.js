const logger = require("../utils/logger");

function errorHandler(err, req, res, _next) {
  logger.error("Unhandled: " + err.message);
  res.status(500).json({
    error: "Forgive me, Sir — an unexpected error occurred. Please try again.",
  });
}

module.exports = errorHandler;
