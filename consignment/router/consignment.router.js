const express = require('express');
const consignment=require('../../consignment/conroller/consignment.details');
const history=require('../../consignment/conroller/historycontroller')

const router = express.Router();
const upload=require('../../middleware/upload')

// Define your routes here

// GET route to fetch consignment details
// router.get('/', (req, res) => {
//     // Add your code to fetch consignment details from the database or any other source
//     // Return the fetched consignment details as a response
// });

// POST route to create a new consignment
router.post('/consignment', consignment.createConsignment,consignment.validateConsignment)
router.get('/getdetails',consignment.getConsignmentsByDate);
router.post('/request-for-consignment',consignment.getconsignment);
router.get('/get-consignment/:phoneNumber',consignment.getallconsignment);
 router.post('/getearning',consignment.getearning);
 router.get('/history/:PhoneNumber',history.getConsignmentHistory);
 router.get('/riderequest/:phoneNumber',consignment.getRideRequests);
router.post('/decline-consignment/:phoneNumber',consignment.declinePaymentRequest)

// // PUT route to update an existing consignment
// router.put('/:id', (req, res) => {
//     // Add your code to update the consignment with the specified ID based on the request body
//     // Return the updated consignment details as a response
// });

// // DELETE route to delete a consignment
// router.delete('/:id', (req, res) => {
//     // Add your code to delete the consignment with the specified ID
//     // Return a success message as a response
// });

module.exports = router;