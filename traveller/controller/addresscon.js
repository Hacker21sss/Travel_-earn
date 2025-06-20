const Address = require("../../traveller/model/address1");


const addAddress = async (req, res) => {
  try {
    const { phoneNumber, location, pincode, flat, street, landmark, city, state, saveAs } = req.body;

    // Validate required fields
    if (!phoneNumber || !location || !pincode || !flat || !street || !city || !state) {
      return res.status(400).json({ message: "phoneNumber, location, pincode, flat, street, city, and state are required" });
    }

    // Validate pincode format (assuming 6 digits for example)
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(pincode)) {
      return res.status(400).json({ message: "Invalid pincode format. Use 6 digits." });
    }

    // Check if the address already exists for the user
    const existingAddress = await Address.findOne({
      phoneNumber,
      flat,
      street,
      landmark,
      city,
      state,
      pincode
    });

    if (existingAddress) {
      return res.status(400).json({ message: "Address already exists for this user" });
    }

    const address = new Address({
      phoneNumber,
      location,
      pincode,
      flat,
      street,
      landmark,
      city,
      state,
      saveAs: saveAs || "Other" // Default to "Other" if saveAs is not provided
    });

    await address.save();

    res.status(201).json({
      message: "Address saved successfully",
      address
    });
  } catch (error) {
    console.error("Error in addAddress:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    // Validate addressId
    if (!addressId) {
      return res.status(400).json({ message: "Address ID is required" });
    }

    // Check if the address exists
    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // Delete the address
    await Address.findByIdAndDelete(addressId);

    res.status(200).json({ message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error in deleteAddress:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


// Controller to get all addresses for a user
const getAddressesByUser = async (req, res) => {
  const { phoneNumber } = req.params; 
  try {
    const addresses = await Address.find({ phoneNumber });
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addAddress,
  getAddressesByUser,
  deleteAddress
};
