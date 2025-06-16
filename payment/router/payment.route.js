const paymentcontroller=require('../controller/payment.controller');
const express = require("express");
const router = express.Router();


router.post("/create-order", paymentcontroller.createOrder);

// Route to verify payment
router.post("/verify-payment", paymentcontroller.verifyOrder);
router.get('/webverify',paymentcontroller.handleRazorpayResponse)

// Route to decline payment
router.post("/decline-payment", paymentcontroller.declinePayment);

module.exports = router;