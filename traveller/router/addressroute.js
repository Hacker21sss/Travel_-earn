const express = require("express");
const router = express.Router();
const { addAddress, getAddressesByUser, deleteAddress, updateAddress } = require("../../traveller/controller/addresscon");

// Define the routes
router.post("/address", addAddress); // POST request to add a new address
router.get("/getaddress/:phoneNumber", getAddressesByUser); // GET request to fetch addresses for a user
router.put("/update/:addressId", updateAddress); // PUT request to update an address
router.delete("/delete/:addressId", deleteAddress); // DELETE request to delete an address

module.exports = router;
