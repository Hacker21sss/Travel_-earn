const {getCoordinates,getDistanceTime,getAutoCompleteSuggestions,getDistanceTimeandcoordiante,calculateETA}=require('../../traveller/controller/mapscontroller');

const express=require('express');
const router=express.Router();
router.get('/get-coordinates',getCoordinates);
router.get('/get-distance-time',getDistanceTime);
router.get('/suggestions',getAutoCompleteSuggestions)
router.get('/getdistanceandcoordinate',getDistanceTimeandcoordiante);
router.get('/eta',calculateETA)


// ride status for earning status show api 

router.get("/ride-status", (req, res) => {
    res.json({
        status: [
            { step: "Ride Completed", completed: true , updatedat : '14th Jan'},
            { step: "Earning (Transaction) In Progress", completed: true },
            { step: "Earning (Transaction) Completed", completed: false }
        ]
    });
});




router.get("/consignment-status", (req, res) => {
    res.json({
        status: [
            { step: "Recieved", completed: true , updatedat : '14th Jan'},
            { step: "Delivered", completed: false },
        ]
    });
});


// router.get("/consignment-collected-status", (req, res) => {
//     res.json({
//         status: [
//             { step: "Consignment Collected", completed: true , updatedat : '14th Jan'},
//             { step: "Consignment Completed", completed: false },
//         ]
//     });
// });



// router.get("/consignment-notification", (req, res) => {
//     res.json({
//         notifications: [
//             {
//                 title: "New Consignment Request Comes",
//                 subtitle: "Abhishek Jain sent you a consignment request",
//                 notificationType: "consignment_request",
//                 notificationFormat: "consignment",
//                 time:'1:51 PM'
//             },
//             {
//                 title: "New Travel Request Comes",
//                 subtitle: "Rahul Sharma sent you a travel request",
//                 notificationType: "travel_request",
//                 notificationFormat: "travel",
//                 time:'1:51 PM'

//             }
//         ]
//     });
// });




router.get("/my-earning", (req, res) => {
    res.json({
        totalAmount: "₹800.0",
        earnings: [
            {
                title: "Wholefood SuperCash Credited",
                travelId: "12345",
                amount: "₹200.0",
                time: "10:30 AM"
            },
            {
                title: "Ride Completed - Payment Received",
                travelId: "12346",
                amount: "₹300.0",
                time: "12:45 PM"
            },
            {
                title: "Referral Bonus Earned",
                travelId: "N/A",
                amount: "₹100.0",
                time: "3:15 PM"
            },
            {
                title: "Travel Booking Payment",
                travelId: "12347",
                amount: "₹200.0",
                time: "6:00 PM"
            }
        ]
    });
});


module.exports=router;
