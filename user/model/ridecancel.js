const mongoose = require('mongoose');
const user=require('../../user/model/Profile');
const travel=require('../../user/model/traveldetails')

const cancelrideSchema=new mongoose.Schema({
    phoneNumber:{type:String,ref:user},
    rideId:{type:String,ref:travel},
    reasonforcancellation:{type:String},
    travelID:{type:String},
})