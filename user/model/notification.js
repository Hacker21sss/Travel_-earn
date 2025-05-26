const mongoose = require("mongoose");
const Consignment=require('../../consignment/model/contraveldetails')
const ride=require('../../user/model/traveldetails')
const user=require('../../user/model/Profile')


const NotificationSchema = new mongoose.Schema({
    phoneNumber: { type: String,ref:user },
    consignmentId: { type: String, ref: Consignment},
    rideId:{type:String,ref:ride},
    travelId:{type:String},
    requestedby:{type:String},
    requestto:{type:String},
     Description:{type:String},
  weight:{type:String},
  category:{type:String,enum:['document','nondocument']},
  subcategory:{type:String},
  dimensions: {
    length: { type: String},
    breadth: { type: String },
    height: { type: String },
    unit: { type: String, enum: ['cm', 'inch'] },
  },
  handleWithCare: {
    type: Boolean,
    default: false,
  },
  specialRequest: {
    type: String,
  },
  dateOfSending: {
    type: Date,
    
  },
  durationAtEndPoint: {
    type: String,
  
  },

    
    earning:{type:String},
    status:{
        type: String,
        enum: ["Pending", "Accepted", "Rejected","Approved"],
        default: "Pending"
    },
    notificationType: {
        type: String,
        enum: ["consignment_request", "ride_request", "ride_accept", "ride_reject","consignment_accept","consignment_reject"],
        
    },
    pickup:{type:String},
    dropoff:{type:String},
    travelmode:{type:String},
    travellername:{type:String},
    pickuptime:{type:String},
    dropofftime:{type:String},
    paymentstatus:{type:String,
      enum:["successful","failed","pending","declined"],
      default:"pending",
    },
   
    
    isRead: { type: Boolean, default: false },
    createdAt: {
  type: Date,
  default: Date.now
}
    
    
    
    
},{timestamps:true});

module.exports = mongoose.model("Notification", NotificationSchema);
