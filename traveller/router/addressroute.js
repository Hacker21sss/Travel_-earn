const express = require("express");
const router = express.Router();
const { addAddress, getAddressesByUser, deleteAddress } = require("../../traveller/controller/addresscon");

// Define the routes
router.post("/address", addAddress); // POST request to add a new address
router.get("/getaddress/:phoneNumber", getAddressesByUser); // GET request to fetch addresses for a user
router.delete("/delete/:addressId", deleteAddress);
module.exports = router;
