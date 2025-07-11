const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  userId: { type: String, ref: "User"},
  phoneNumber:{type:String,ref:"User"}, // Assuming user linkage
  location: { type: String},
  pincode: { type: String, required: true },
  flat: { type: String, required: true },
  street: { type: String, required: true },
  landmark: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  saveAs: { type: String, enum: ["Home", "Others", "Work"], required: true },
  customName: { type: String }, // For "Others" option
  displayAddress: { type: String }, // Full formatted address for display
  googleMapsAddress: { type: String }, // Address for Google Maps
  latitude: { type: Number },
  longitude: { type: Number},
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
addressSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Address = mongoose.model("Address12", addressSchema);
module.exports = Address;
