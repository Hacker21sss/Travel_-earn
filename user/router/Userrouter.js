const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const userController = require("../controller/Usercontroller");
const auth=require('../../middleware/authmiddleware')

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  "/send-otp",
  body("phoneNumber")
    .trim()
    .isLength({ min: 10, max: 15 })
    .isMobilePhone()
    .withMessage("Invalid phone number format"),
  validateRequest,
  userController.sendOtp
);

router.post(
  "/verify-otp",
  [
    body("phoneNumber")
      .trim()
      .isLength({ min: 10, max: 15 })
      .isMobilePhone()
      .withMessage("Invalid phone number format"),
    body("otp")
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage("OTP must be numeric")
  ],
  validateRequest,
  userController.verifyOtp
);

router.post(
  "/resend-otp",
  body("phoneNumber")
    .trim()
    .isLength({ min: 10, max: 15 })
    .isMobilePhone()
    .withMessage("Invalid phone number format"),
  validateRequest,
  userController.resendotp
);

// router.post(
//   "/login",
//   body("phoneNumber")
//     .trim()
//     .isLength({ min: 10, max: 15 })
//     .isMobilePhone()
//     .withMessage("Invalid phone number format"),
//   validateRequest,
//   userController.loginRegister
// );

module.exports = router;
