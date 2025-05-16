const mongoose = require("mongoose");
const ConsignmentDetails=require('../../consignment/model/contraveldetails')
const TravelDetails=require('../../user/model/traveldetails');
const User = require("../../user/model/Profile");

const ConsignmentRequestHistorySchema = new mongoose.Schema({
  
 
  ownerPhoneNumber: { type: String}, // Consignment owner
  consignmentId: { type: String, ref: ConsignmentDetails},
  
  senderName: { type: String },
  senderPhoneNumber: { type: String },
  senderAddress: { type: String },
  receiverName: { type: String },
  receiverPhoneNumber: { type: String },
  description: { type: String, ref: ConsignmentDetails },
  receiverAddress: { type: String },
   
  category: { type: String },
  // e.g., "10X10X12"
  distance: { type: String },

  status: {
    type: String,
    enum: ["Cancelled", "Collected", "Completed", "Not Started","Delivered",]
    
  },
  sotp: {type:String},
              rotp: {type:String},
  expectedEarning: { type: Number },
  consignmentpickuptime:{type:Object,default:null},
  consignmentdelivertime:{type:Object,default:null},
  collected:{type:Object,default:null},
  delivered:{type:Object,default:null},
  pickupLocation: {
        lat: { type: Number },
        lng: { type: Number },
    },
    deliveryLocation: {
        lat: { type: Number },
        lng: { type: Number },
    },
  traveldetails: [
    {
      travelMode: { type: String, enum: ["train", "airplane","car"] },
      username:{type:String},
      rideId: { type: String },
      travelId: { type: String },
      timestamp: { type: Date, default: Date.now },
      phoneNumber:{type:String,ref:TravelDetails},
      
      profilePicture:{type:String,ref:User},
      rating:{type:String},
      totalrating:{type:String}
    },
  ],
  createdAt: { type: Date, default: Date.now },

  
});

module.exports = mongoose.model("ConsignmentRequestHistory", ConsignmentRequestHistorySchema);
