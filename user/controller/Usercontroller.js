const User1 = require("../model/User");
require('dotenv').config();
const profile=require('../../user/model/Profile');
const axios=require('axios')
const Profile = require("../../user/model/Profile");

const FormData = require('form-data');


const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); 
};

exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Clean and validate phone number
    const cleanedPhoneNumber = phoneNumber.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,}$/.test(cleanedPhoneNumber)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    let is_newuser = true;

    let user = await User1.findOne({ phoneNumber: cleanedPhoneNumber });

    if (user) {
      is_newuser = false;
      await User1.updateOne({ phoneNumber: cleanedPhoneNumber }, { otp, expiresAt });
    } else {
      user = new User1({ phoneNumber: cleanedPhoneNumber, otp, expiresAt });
      await user.save();
    }

    console.log(`🔹 Generated OTP for ${cleanedPhoneNumber}: ${otp}`);

    const message = `${otp} is OTP to Login to Timestrings System App. Do not share with anyone.`;

    
    const formData = new FormData();
    formData.append('userid', 'timestrings');
    formData.append('password', 'X82w2G4f');
    formData.append('mobile', cleanedPhoneNumber);
    formData.append('senderid', 'TMSSYS');
    formData.append('dltEntityId', '1701173330327453584');
    formData.append('msg', message);
    formData.append('sendMethod', 'quick');
    formData.append('msgType', 'text');
    formData.append('dltTemplateId', '1707173406941797486');
    formData.append('output', 'json');
    formData.append('duplicatecheck', 'true');
    formData.append('dlr', '1'); 

    
    const response = await axios({
      method: 'post',
      url: 'https://app.pingbix.com/SMSApi/send',
      headers: {
        ...formData.getHeaders(), 
        'Cookie': 'SERVERID=webC1', 
      },
      data: formData,
      maxBodyLength: Infinity,
    });

    console.log("✅ API Response:", response.data);

    if (response.data) {
      return res.status(200).json({ message: "OTP sent successfully", is_newuser });
    } else {
      return res.status(500).json({ error: "Error sending OTP" });
    }
  } catch (error) {
    console.error("❌ Error sending OTP:", error.response?.data || error.message);

    if (!res.headersSent) {
      return res.status(500).json({ error: "Error sending OTP" });
    }
  }
};



   exports. resendotp=async(req,res)=>{
    try{
      const {phoneNumber}=req.body;
      const user=await profile.findOne({phoneNumber});
      if(!user){
        return res.status(400).json({error:"User not found"});
    }
  
   
    const currentTime = Date.now();
   
    if (user.otpTimestamp && currentTime - user.otpTimestamp < 10000) {
      return res.status(400).json({ error: "Please wait 10 seconds before requesting a new OTP" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000);
  
    const expiresAt = currentTime + 300000; // 5 mins 
   
    
    
    await profile.updateOne(
      { phoneNumber },
      { otp, otpTimestamp: currentTime,expiresAt }
  );

  return res.status(200).json({ message: "OTP sent successfully", otp });
} catch (error) {
  console.error(error);
  return res.status(500).json({ error: "Internal Server Error" });
}
    
   }



exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    console.log("📩 Received request:", { phoneNumber, otp });

    if (!phoneNumber || !otp) {
      console.log("❌ Missing phoneNumber or OTP");
      return res.status(400).json({ error: "Phone number and OTP are required" });
    }

    const user = await User1.findOne({ phoneNumber });

    console.log("🔍 Found user:", user);

    if (!user) {
      console.log("❌ User not found for phoneNumber:", phoneNumber);
      return res.status(400).json({ error: "User not found" });
    }

    console.log("🛂 Stored OTP:", user.otp, " | Received OTP:", otp);

    if (!user.otp || String(user.otp).trim() !== String(otp).trim()) {
      console.log("❌ Invalid OTP");
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (!user.expiresAt || Date.now() > user.expiresAt) {
      console.log("⏳ OTP expired for user:", phoneNumber);
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    await User1.updateOne({ phoneNumber }, { otp: null, expiresAt: null });

    console.log("✅ OTP verification successful for user:", phoneNumber);

    
    const profile = await Profile.findOne({ phoneNumber });

    if (!profile) {
      console.log("🚨 No profile found for phoneNumber:", phoneNumber);
      return res.status(200).json({ 
        message: "OTP verified successfully", 
        isNewUser: true  
      });
    }

    console.log("🎉 Existing user. Sending userDetails:", {
      firstName: profile.firstName || "N/A",
      lastName: profile.lastName || "N/A",
      email: profile.email || "N/A",
      phoneNumber: profile.phoneNumber || "N/A",
      profilePicture: profile.profilePicture || "No profile picture",
    });

    return res.status(200).json({ 
      message: "OTP verified successfully", 
      isNewUser: false,
      userDetails: {
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phoneNumber: profile.phoneNumber || "",
        profilePicture: profile.profilePicture || "",  
      }
    });

  } catch (error) {
    console.error("❗ Error verifying OTP:", error);
    return res.status(500).json({ error: "Error verifying OTP" });
  }
};





