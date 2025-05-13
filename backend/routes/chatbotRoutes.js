const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');

// Process incoming chat message
router.post('/message', chatbotController.processMessage);

// Get chat history for a user
router.get('/history/:userId', chatbotController.getChatHistory);

module.exports = router;