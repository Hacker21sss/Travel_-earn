const userprofiles = require("../model/Profile");
const Traveler = require("../model/Profile");
const { validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const imagekit = require("../controller/imagekit");

exports.createUserProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { phoneNumber, firstName, lastName, email } = req.body;

    // Commented out code for checking existing users
    // if (phoneNumber) {
    //   const existingUser = await userprofiles.findOne({ phoneNumber });
    //   if (existingUser) {
    //     return res.status(400).json({ msg: ' already exists' });
    //   }
    // }

    const userId = uuidv4();
    let profilePictureUrl = null;

    // Only attempt to upload if req.file exists
    if (req.file) {
      try {
        const filePath = req.file.buffer;

        // Upload the image to ImageKit
        const uploadResponse = await imagekit.upload({
          file: filePath,
          fileName: `${userId}_profile_picture`,
          useUniqueFileName: true,
        });

        // Get the URL of the uploaded file from ImageKit
        profilePictureUrl = uploadResponse.url;
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(400).json({
          message: "Error uploading profile picture",
          error: uploadError.message,
        });
      }
    }

    const newUser = new userprofiles({
      userId,
      phoneNumber,
      firstName,
      lastName,
      email: email || null,
      profilePicture: profilePictureUrl,
    });

    await newUser.save();

    res.status(201).json({
      message: "User profile created successfully.",
      user: newUser,
    });
  } catch (err) {
    console.error("User profile creation error:", err);
    res.status(500).json({
      message: "Error creating user profile.",
      error: err.message,
    });
  }
};

// **Traveler Registration**
// For generating unique IDs
// exports.createUserProfile = async (req, res) => {
//   // Validate incoming request data
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }

//   try {
//     const { phoneNumber, firstName, lastName, email } = req.body;

//     // Handle profile picture upload if provided
//     let profilePictureUrl = null;
//     if (req.file) {
//       const result = await cloudinary.uploader.upload(req.file.path);
//       profilePictureUrl = result.secure_url;
//       fs.unlinkSync(req.file.path); // Remove the file after uploading
//     }

//     // Generate a unique user ID and create a new user profile
//     const userId = uuidv4();
//     const newUser = new userprofiles({
//       userId,
//       phoneNumber,
//       firstName,
//       lastName,
//       email,
//       profilePicture: profilePictureUrl,
//     });

//     // Generate a JWT token for the new user profile
//     // const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '24d' });
//     // console.log('Generated Token:', token);

//     // // Add the token to the user's token array or as a property
//     // newUser.tokens = [{ token }];

//     // Save the new user profile to the database
//     await newUser.save();

//     // Send back the response with user details and the token
//     res.status(201).json({
//       message: 'User profile created successfully.',
//        user: newUser,
//       // token: token, // Return the token in the response
//     });
//   } catch (err) {
//     console.error('Error creating user profile:', err);
//     res.status(500).json({ message: 'Error creating user profile.' });
//   }
// };
exports.registerAsTraveler = async (req, res) => {
  try {
    const userId = req.params.userId; // Retrieve userId from the request params
    const { licenseNumber, aadharCard, vehicleDetails } = req.body;

    // Validate inputs
    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (!licenseNumber || !aadharCard || !vehicleDetails) {
      return res
        .status(400)
        .json({
          message:
            "All verification details (license number, Aadhaar card, and vehicle details) are required.",
        });
    }

    // Check if the user exists in the UserProfile model
    const user = await UserProfile.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if the user is already registered as a traveler
    if (user.travellerId) {
      return res
        .status(400)
        .json({ message: "User is already registered as a traveler." });
    }

    // Validate phone number
    if (!user.phoneNumber) {
      return res
        .status(400)
        .json({ message: "Phone number is required and cannot be null." });
    }

    // Generate a custom travelerId (e.g., a random string or UUID)
    const customTravelerId = `TRV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Create a new Traveler profile
    const newTraveler = new Traveler({
      travellerId: customTravelerId, // Use custom traveler ID
      licenseNumber,
      aadharCard,
      vehicleDetails,
      isVerified: true, // Mark as verified if all details are provided
    });

    // Save the new Traveler profile
    const traveler = await newTraveler.save();

    // Link the travellerId to the user profile
    user.travellerId = traveler.travellerId; // Save the custom travelerId in the user profile
    await user.save();

    res
      .status(201)
      .json({
        message: "Traveler (Driver) registered successfully.",
        traveler,
      });
  } catch (err) {
    console.error("Error registering traveler:", err.message);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({
          message: "Duplicate key error.",
          field: Object.keys(err.keyValue)[0],
        });
    }
    res
      .status(500)
      .json({ message: "Error registering traveler.", error: err.message });
  }
};

// **Login (Common for User and Traveler)**

// **Fetch User Profile**
// exports.getUserProfileByPhoneNumber = async (req, res) => {
//   try {
//     const { phoneNumber } = req.query; // Assuming phoneNumber is passed as a query parameter

//     // Validate input
//     if (!phoneNumber) {
//       return res.status(400).json({ message: 'Phone number is required.' });
//     }

//     // Fetch user profile by phone number
//     const user = await UserProfile.findOne({ phoneNumber });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found.' });
//     }

//     res.status(200).json({ message: 'User profile fetched successfully.', user });
//   } catch (err) {
//     console.error('Error fetching user profile:', err);
//     res.status(500).json({ message: 'Error fetching user profile.' });
//   }
// };
exports.getUserProfileByPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.params; // Assuming phoneNumber is passed as a query parameter

    console.log(phoneNumber)
    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    // Sanitize and format phone number (if necessary)
    const sanitizedPhoneNumber = phoneNumber.trim(); // Remove any leading/trailing whitespace
    const formattedPhoneNumber = sanitizedPhoneNumber.startsWith("+")
      ? sanitizedPhoneNumber
      : `+${sanitizedPhoneNumber}`; // Add '+' if not already present (optional)

    console.log("Received phoneNumber:", formattedPhoneNumber); // Debugging log

    // Fetch user profile by phone number
    const user = await userprofiles.findOne({
      phoneNumber: formattedPhoneNumber,
    });

    console.log("Query result:", user);

    // Handle case where user is not found
    if (!user) {
      return res.status(404).json({
        message: `User not found for phone number: ${formattedPhoneNumber}. Please check the phone number and try again.`,
      });
    }

    // Respond with user profile
    res.status(200).json({
      message: "User profile fetched successfully.",
      user,
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res
      .status(500)
      .json({ message: "An error occurred while fetching the user profile." });
  }
};



exports.updateUserProfile = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { firstName, lastName, email, isVerified } = req.body;
    const updateFields = {};

    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email;
    if (isVerified !== undefined) updateFields.isVerified = isVerified;

    // Handle profile picture upload with ImageKit if file is provided
    if (req.file) {
      try {
        const fileBuffer = req.file.buffer;

        // Validate file buffer
        if (!fileBuffer || fileBuffer.length === 0) {
          return res.status(400).json({
            message: "Invalid file data received",
          });
        }

        // Upload the image to ImageKit with better error handling
        const uploadResponse = await imagekit.upload({
          file: fileBuffer,
          fileName: `${phoneNumber}_profile_picture_${Date.now()}`,
          useUniqueFileName: true,
          folder: '/profile-pictures', // Organize files in a folder
        });

        // Set the ImageKit URL as the profile picture
        updateFields.profilePicture = uploadResponse.url;

        console.log("Image uploaded successfully:", uploadResponse.url);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);

        // Provide more specific error messages
        let errorMessage = "Failed to upload profile picture";

        if (uploadError.message.includes("Network request failed")) {
          errorMessage = "Network error: Unable to connect to image upload service. Please check your internet connection and try again.";
        } else if (uploadError.message.includes("authentication")) {
          errorMessage = "Authentication error: Invalid image upload credentials.";
        } else if (uploadError.message.includes("file size")) {
          errorMessage = "File too large: Please upload an image smaller than 5MB.";
        } else {
          errorMessage = `Upload failed: ${uploadError.message}`;
        }

        return res.status(400).json({
          message: errorMessage,
          error: uploadError.message,
        });
      }
    }

    console.log("updated fields : ", updateFields)
    const updatedUser = await userprofiles.findOneAndUpdate(
      { phoneNumber },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ message: "Error updating user profile" });
  }
};
