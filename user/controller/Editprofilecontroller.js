const EditProfile = require("../model/Editprofile");
const imagekit = require("../controller/imagekit");
const mongoose = require('mongoose');

// Get profile by UserId
const getProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    console.log(`Received UserId: ${userId}`);

    const profile = await EditProfile.findOne({ UserId: userId });
    console.log(`Query Result: ${profile}`);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
};

// Create or update profile
const createOrUpdateProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId format" });
    }

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    // Validate phone number format if provided
    if (req.body.phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(req.body.phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Validate email format if provided
    if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Initialize profile data with existing fields and type validation
    const profileData = {
      firstname: String(req.body.firstname || ""),
      lastname: String(req.body.lastname || ""),
      email: String(req.body.email || ""),
      phoneNumber: String(req.body.phoneNumber || ""),
      accountNumber: String(req.body.accountNumber || ""),
      accountName: String(req.body.accountName || ""),
      ifscCode: String(req.body.ifscCode || ""),
      bankName: String(req.body.bankName || ""),
      branch: String(req.body.branch || ""),
    };

    // Handle profile picture upload with ImageKit if file is provided
    if (req.file && req.file.buffer) {
      try {
        const fileBuffer = req.file.buffer;
        
        // Validate file size (e.g., max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (fileBuffer.length > maxSize) {
          return res.status(400).json({
            message: "File size too large. Maximum size allowed is 5MB"
          });
        }

        // Upload the image to ImageKit
        const uploadResponse = await imagekit.upload({
          file: fileBuffer,
          fileName: `${userId}_profile_picture`,
          useUniqueFileName: true,
        });

        if (!uploadResponse || !uploadResponse.url) {
          throw new Error("Failed to upload image");
        }

        // Set the ImageKit URL as the profile picture
        profileData.ProfilePicture = uploadResponse.url;
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(400).json({
          message: "Error uploading profile picture",
          error: uploadError.message,
        });
      }
    } else if (req.body.ProfilePicture && typeof req.body.ProfilePicture === 'string') {
      // If no file but URL provided in body, validate URL format
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(req.body.ProfilePicture)) {
        return res.status(400).json({ message: "Invalid profile picture URL format" });
      }
      profileData.ProfilePicture = req.body.ProfilePicture;
    }

    // Check if the profile exists and update or create
    const profile = await EditProfile.findOneAndUpdate(
      { UserId: userId },
      { $set: profileData },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Profile saved successfully", profile });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
};

// Delete profile by UserId
const deleteProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedProfile = await EditProfile.findOneAndDelete({
      UserId: userId,
    });

    if (!deletedProfile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json({ message: "Profile deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server Error", details: error.message });
  }
};

module.exports = {
  getProfileByUserId,
  createOrUpdateProfile,
  deleteProfileByUserId,
};
