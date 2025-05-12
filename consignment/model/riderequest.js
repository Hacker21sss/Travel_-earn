const mongoose = require("mongoose");

const ride=require('../../user/model/traveldetails')
const user=require('../../user/model/User')


const ridetocarryrequestSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true,ref:user},
    username:{type:String},
    rideId: { type: String, ref: ride},
    rider:{type:String},
    requestedby:{type:String},
    requestto:{type:String},
    travelMode:{type:String},
    expectedstarttime:{type:String},
    expectedendtime:{type:String},

      consignmentId:{type:String},
    
    createdAt: { type: Date, default: Date.now },
    pickup:{type:String},
    drop:{type:String},
    travelId:{type:String,ref:ride},
    earning:{type:String},
    bookingId:{type:String}
    
 
    
});

module.exports = mongoose.model("rider_request", ridetocarryrequestSchema );
