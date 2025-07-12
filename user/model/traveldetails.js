const mongoose = require('mongoose');
const user=require('../../user/model/Profile')

const TraveldetailsSchema = new mongoose.Schema({
  // userId: { type: String, ref: 'user', required: true },
  phoneNumber:{type:String,ref:user},
  username:{type:String},
  travellername:{type:String,ref:user},
  Leavinglocation: { type: String, required: true },
  Goinglocation: { type: String, required: true },
  fullFrom:{type:String},
  fullTo:{type:String},
  LeavingCoordinates: {
    ltd: { type: Number },
    lng: { type: Number }
  },
  GoingCoordinates: {
    ltd: { type: Number },
    lng: { type: Number }
  },
  distance: { type: String },
  duration:{type:String},
  travelMode: { type: String},
  travelmode_number:{type:String},
  travelDate: { type: Date, required: true },
  expectedStartTime: { type: String },
  expectedEndTime: { type: String },
  rideId:{type:String},
  expectedearning:{type:String},
 
  weight:{type:String},
  TE:{type:String},
  discount:{type:String},
  payableAmount:{type:String},
  travelId:{type:String},
  status: { 
    type: String, 
    enum: ["Pending","Accepted", "Not Started","started", "In Progress", "Completed", "Cancelled"], 
    default: "Pending" 
  },
  startedat:{type:Object,default:null},
  endedat:{type:Object,default:null},
  reasonforcancellation:{type:String},
  selectedreason:{type:String},
  userrating:{type:[Number],default: []},
  totalrating:{type:Number,default: 0},
  averageRating:{type:Number,default: 0},
  
  
 
}, { timestamps: true });

module.exports = mongoose.model('Traveldetails', TraveldetailsSchema);
