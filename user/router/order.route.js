const express = require("express");
const router = express.Router();
const ordercontroller = require("../../user/controller/orderhistory.controller");


router.get("/orders/:phoneNumber", ordercontroller.getorder);

module.exports = router;
