const express = require('express');
const Earnings = require('../../traveller/controller/earningcontroller')
const router = express.Router();

// Fetch earnings by driver ID
router.get('/earning',Earnings.getEarnings)
  

module.exports = router;
