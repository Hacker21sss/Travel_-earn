const mongoose = require('mongoose');
const consignment=require('../../consignment/model/contraveldetails')
const user=require('../../user/model/Profile')
const notification=require('../../user/model/notification')
const InstructionSchema = new mongoose.Schema({
    travelId: { type: String, ref:notification},
    userName: { type: String, required: true,ref:consignment },
    recievername:{type:String,ref:consignment},
    pickupLocation: { type: String, required: true },
    handoverInstructions: { type: String, required: true },
    updatestatus:{
        type:String,
        enum:['started','completed']
    },
    sotp:{type:String,ref:consignment},
    rotp:{type:String,ref:consignment},
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Instruction', InstructionSchema);
