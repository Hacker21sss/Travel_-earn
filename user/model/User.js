const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  otp: { type: String },
  otpTimestamp: { type: Number, default: 0 },
  expiresAt: { type: Number } 

});

userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  });
  


module.exports = mongoose.model("User1", userSchema);
