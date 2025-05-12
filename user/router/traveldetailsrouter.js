const express = require('express');
const router = express.Router();
const travelController = require('../../user/controller/TraveldetailsController');
const traveldetails = require('../model/traveldetails');

router.post('/creates', travelController.getAutoCompleteAndCreateBooking);
// router.post('/searchNearestDrivers', travelController.searchNearestDrivers);
// router.post('/requestDriver', travelController.requestDriver);
// router.get('/', travelController.getAllTravelDetails);
// router.get('/:id', travelController.getTravelDetailById);
// router.put('/:id', travelController.updateTravelDetail);
// router.delete('/:id', travelController.deleteTravelDetail);
// router.get('/get',travelController.traveldetail)
router.get("/search-rides", travelController.searchRides)
router.post('/booking-request',travelController.booking)
router.get('/get-all-rides/:phoneNumber',travelController.getAllRides)
// router.post('/send-notification',travelController.sendnotificationtorider);
router.get('/travel/:travelId',travelController.traveldetailsusingtravelid);
router.post('/start-ride/:travelId',travelController.starttravel);
router.post('/end-ride/:travelId',travelController.endtravel);
router.get('/travelhistory/:phoneNumber',travelController.getTravelHistory);
router.get('/request/:phoneNumber',travelController.consignmentcarryrequest);
router.post('/update-current-location/:phoneNumber',travelController.driverstatuslocationupdate);
router.get('/get-current-location/:phoneNumber',travelController.trackRiderLiveLocation)


module.exports = router;
