const mongoose = require('mongoose');
const Travel=require('../../user/model/traveldetails')

const consignmentToCarrySchema = new mongoose.Schema({
    consignmentId: {
        type: String
    },
    travelId: {
        type: String,
        ref: Travel,
      
    },
    sender: {
        type: String,
        
    },
    receiver: {
        type: String,
       
    },
    startinglocation:{type:String},
    droplocation:{type:String},
    weight: {
        type: String,
       
    },
    dimensions: {
        type: String,
        
    },
    senderphone:{type:String},
    receiverphone:{type:String},
    earning:{type:String},
    status: {
        type: String,
        enum: ['Yet to Collect', 'Collected', 'In Transit', 'Delivered'],
        default: 'Yet to Collect'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    },
    dateandtimeofdelivery:{type:String}
});

const ConsignmentToCarry = mongoose.model('ConsignmentToCarry', consignmentToCarrySchema);

module.exports = ConsignmentToCarry;
