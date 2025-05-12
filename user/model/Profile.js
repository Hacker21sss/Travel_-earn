const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    
   
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    phoneNumber: { type: String,unique:true   },
    profilePicture:{type: String},
    // password: { type: String, required: true },  // Hash this password before saving
    tokens: [{ token: { type: String } }],
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'traveler'], default: 'user' }, // Default role is 'user'
    userId: { type: String,  },
     // Links to Traveler data
    createdAt: { type: Date, default: Date.now },
    socketId:{type:String},
    userrating:{type:String},
    totalrating:{type:String},
    feedback:{type:String},
    
    otpTimestamp: { type: Number, default: 0 },
    expiresAt: { type: Number } ,
    currentLocation: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point"
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0]
        }
    },
    lastUpdated: { type: Date, default: Date.now } 
});
// const travelerSchema = new mongoose.Schema({
//      // Link to the user
//     licenseNumber: { type: String, required: true },
//     aadharCard: { type: String, required: true },
//     Pancard: { type: String, required: true },
//     isVerified: { type: Boolean, default: false }, // Admin verification
//     createdAt: { type: Date, default: Date.now },
//     socketId:{type:String}
//   });
//   module.exports = mongoose.model('Traveler', travelerSchema);
userSchema.index({ currentLocation: "2dsphere" });
module.exports = mongoose.model('userprofiles', userSchema);
