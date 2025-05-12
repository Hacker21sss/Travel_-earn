const express = require('express');
const driverController = require('../../traveller/controller/Travellercon'); // Import the controller
const router = express.Router();

// Search endpoint
router.post('/search', driverController.getDriversByDateAndLocations); // Use controller method for this route

module.exports = router;
