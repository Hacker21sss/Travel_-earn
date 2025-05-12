const express = require('express');
const {
    setconsignmetstatus ,
    pickupconsignment,deliver
    
} = require('../controller/DeliveryInstructionController');

const router = express.Router();

// Routes
// router.post('/start',startRide );

router.post('/pickupconsignment',pickupconsignment),
router.post('/deliver',deliver)
router.get('/consignment-collected-status/:phoneNumber', setconsignmetstatus);
// router.put('/:orderId', updateInstructionByOrderId);
// router.delete('/:orderId', deleteInstructionByOrderId);

module.exports = router;
