const ride=require('../../service/Ride.service');
const rideservicecontroller=require('../../traveller/controller/consignmenttocarrycon')

 const express = require("express");
const router = express.Router();


router.post('/respond' ,ride.respondToRideRequest);
router.post('/respondto',ride.respondToConsignmentRequest);
router.get('/consignmenttocarry/:travelId',rideservicecontroller.consignmenttocarry);
router.get('/get-ride/:travelId',ride.getRideStatus)
module.exports = router;