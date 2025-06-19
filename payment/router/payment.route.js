const paymentcontroller=require('../controller/payment.controller');
const express = require("express");
const router = express.Router();


router.post("/create-order", paymentcontroller.createOrder);

// Route to verify payment
router.post("/verify-payment", paymentcontroller.verifyOrder);
router.get('/webverify',paymentcontroller.handleRazorpayResponse)

module.exports = router;