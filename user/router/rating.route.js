// routes/route.js
const express = require('express');
const router = express.Router();
const rating = require('../../user/controller/ratingcontroller');

// Define your route for fetching the best route and polyline
router.post('/rating/:phoneNumber', rating.submitRating);

module.exports = router;
