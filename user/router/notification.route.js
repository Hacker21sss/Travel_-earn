const notify=require('../../user/controller/notification.controller')
const express = require("express");

const router = express.Router();



router.get('/getnotification/consignment/:phoneNumber',notify.getUserNotifications);
// router.get('/get-notify-rider/:phoneNumber',notify.getnotificationforrider);
router.get('/getnotification/travel/:phoneNumber',notify.getNotifications);
router.post('/cancel-ride/:phoneNumber/:travelId',notify.cancelride);
// router.get('/ride-notification/:phoneNumber',notify.getRideNotifications);
// router.get('/consignment-notification/:phoneNumber',notify.getConsignmentNotifications); 


module.exports=router;