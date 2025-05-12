const EditProfile = require("../model/Editprofile");
const imagekit = require("../controller/imagekit");

// Get profile by UserId
const getProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Received UserId: ${userId}`); // Log the received UserId

    const profile = await EditProfile.findOne({ UserId: userId });
    console.log(`Query Result: ${profile}`); // Log the result of the query

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error(error.message); // Log any errors
    res.status(500).json({ error: "Server Error", details: error.message });
  }
};

// Create or update profile
const createOrUpdateProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    // Initialize profile data with existing fields
    const profileData = {
      firstname: req.body.firstname || "",
      lastname: req.body.lastname || "",
      email: req.body.email || "",
      phoneNumber: req.body.phoneNumber || "",
      accountNumber: req.body.accountNumber || "",
      accountName: req.body.accountName || "",
      ifscCode: req.body.ifscCode || "",
      bankName: req.body.bankName || "",
      branch: req.body.branch || "",
    };

    // Handle profile picture upload with ImageKit if file is provided
    if (req.file) {
      try {
        const fileBuffer = req.file.buffer;

        // Upload the image to ImageKit
        const uploadResponse = await imagekit.upload({
          file: fileBuffer,
          fileName: `${userId}_profile_picture`,
          useUniqueFileName: true,
        });

        // Set the ImageKit URL as the profile picture
        profileData.ProfilePicture = uploadResponse.url;
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(400).json({
          message: "Error uploading profile picture",
          error: uploadError.message,
        });
      }
    } else if (req.body.ProfilePicture) {
      // If no file but URL provided in body, use that
      profileData.ProfilePicture = req.body.ProfilePicture;
    }

    // Check if the profile exists and update or create
    const profile = await EditProfile.findOneAndUpdate(
      { UserId: userId },
      { $set: profileData },
      { new: true, upsert: true } // Create if not exists
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
