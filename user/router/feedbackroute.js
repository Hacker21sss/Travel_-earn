// routes/feedbackRoutes.js
const express = require('express');
const router = express.Router();
const feedbackController = require('../controller/feedbackcontroller');

router.post('/submit', feedbackController.submitFeedback);
router.get('/all/:phoneNumber', feedbackController.getAllFeedback);

module.exports = router;


