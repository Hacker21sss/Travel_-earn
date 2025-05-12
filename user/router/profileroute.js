const express = require("express");

const userController = require("../controller/profilecontroller");

const { body } = require("express-validator");
const router = express.Router();
const upload = require("../../middleware/upload");
const auth = require("../../middleware/authmiddleware");

// Setup multer for file upload

router.post(
  "/create",
  upload.single("profilePicture"), // Ensure file is uploaded before validation
  [
    body("phoneNumber").isMobilePhone().withMessage("Invalid phone number."),
    body("firstName").notEmpty().withMessage("First name is required."),
    body("lastName").notEmpty().withMessage("Last name is required."),
    body("email").isEmail().optional().withMessage("Invalid email address."),
  ],
  userController.createUserProfile
);

router.put(
  "/update/:phoneNumber",
  upload.single("profilePicture"), // Add this middleware
  userController.updateUserProfile
);

router.get("/getall/:phoneNumber", userController.getUserProfileByPhoneNumber);

module.exports = router;
