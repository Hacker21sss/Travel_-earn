const mongoose = require("mongoose");
const Consignment=require('../../consignment/model/contraveldetails')
const ride=require('../../user/model/traveldetails')
const user=require('../../user/model/Profile')


const consignmenttocarryrequestSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true,ref:user },
    consignmentId: { type: String, ref: Consignment},
    travellername:{type:String},
    travelmode:{type:String},
    requestedby:{type:String},
    requestto:{type:String},
    weight:{type:String},
    dimension:{type:String},

    
    createdAt: { type: Date, default: Date.now },
    pickup:{type:String},
    drop:{type:String},
    travelId:{type:String,ref:ride},
    earning:{type:String},
    bookingId:{type:String},
    status: {
        type: String,
        enum: ["Accepted", "Rejected", "Expired"],
    }
    
    
    
 
    
});

module.exports = mongoose.model("consignment_carry_rider", consignmenttocarryrequestSchema );
