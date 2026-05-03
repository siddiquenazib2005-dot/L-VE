const express    = require("express");
const router     = express.Router();
const validate   = require("../middleware/validate");
const controller = require("../controllers/chatController");

router.post("/chat",  validate, controller.handleChat);
router.post("/clear", controller.handleClear);

module.exports = router;
