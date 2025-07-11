const Address = require("../../traveller/model/address1");


const addAddress = async (req, res) => {
  try {
    const { 
      phoneNumber, 
      location, 
      pincode, 
      flat, 
      street, 
      landmark, 
      city, 
      state, 
      saveAs, 
      customName,
      displayAddress,
      googleMapsAddress,
      latitude,
      longitude
    } = req.body;

    // Validate required fields
    if (!phoneNumber || !location || !pincode || !flat || !street || !city || !state) {
      return res.status(400).json({ 
        message: "phoneNumber, location, pincode, flat, street, landmark, city, and state are required" 
      });
    }

    // Validate pincode format (6 digits)
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(pincode)) {
      return res.status(400).json({ message: "Invalid pincode format. Use 6 digits." });
    }

    // Validate saveAs field
    if (!saveAs || !["Home", "Others", "Work"].includes(saveAs)) {
      return res.status(400).json({ message: "saveAs must be one of: Home, Others, Work" });
    }

    // Validate customName when saveAs is "Others"
    if (saveAs === "Others" && (!customName || customName.trim() === '')) {
      return res.status(400).json({ message: "customName is required when saveAs is 'Others'" });
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

    // Create address object with all fields
    const addressData = {
      phoneNumber,
      location,
      pincode,
      flat,
      street,
      landmark,
      city,
      state,
      saveAs,
      displayAddress,
      googleMapsAddress
    };

    // Add customName only if saveAs is "Others"
    if (saveAs === "Others" && customName) {
      addressData.customName = customName;
    }

    // Add coordinates if provided
    if (latitude && longitude) {
      addressData.latitude = parseFloat(latitude);
      addressData.longitude = parseFloat(longitude);
    }

    const address = new Address(addressData);
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
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const addresses = await Address.find({ phoneNumber }).sort({ createdAt: -1 });
    
    // Format addresses for frontend
    const formattedAddresses = addresses.map(address => ({
      id: address._id,
      phoneNumber: address.phoneNumber,
      location: address.location,
      pincode: address.pincode,
      flat: address.flat,
      street: address.street,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      saveAs: address.saveAs,
      customName: address.customName,
      displayAddress: address.displayAddress,
      googleMapsAddress: address.googleMapsAddress,
      latitude: address.latitude,
      longitude: address.longitude,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt
    }));

    res.status(200).json({
      success: true,
      addresses: formattedAddresses,
      count: formattedAddresses.length
    });
  } catch (error) {
    console.error("Error in getAddressesByUser:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Controller to update an address
const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { 
      location, 
      pincode, 
      flat, 
      street, 
      landmark, 
      city, 
      state, 
      saveAs, 
      customName,
      displayAddress,
      googleMapsAddress,
      latitude,
      longitude
    } = req.body;

    // Validate addressId
    if (!addressId) {
      return res.status(400).json({ message: "Address ID is required" });
    }

    // Check if the address exists
    const existingAddress = await Address.findById(addressId);
    if (!existingAddress) {
      return res.status(404).json({ message: "Address not found" });
    }

    // Validate required fields
    if (!location || !pincode || !flat || !street || !landmark || !city || !state) {
      return res.status(400).json({ 
        message: "location, pincode, flat, street, landmark, city, and state are required" 
      });
    }

    // Validate pincode format
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(pincode)) {
      return res.status(400).json({ message: "Invalid pincode format. Use 6 digits." });
    }

    // Validate saveAs field
    if (!saveAs || !["Home", "Others", "Work"].includes(saveAs)) {
      return res.status(400).json({ message: "saveAs must be one of: Home, Others, Work" });
    }

    // Validate customName when saveAs is "Others"
    if (saveAs === "Others" && (!customName || customName.trim() === '')) {
      return res.status(400).json({ message: "customName is required when saveAs is 'Others'" });
    }

    // Update address data
    const updateData = {
      location,
      pincode,
      flat,
      street,
      landmark,
      city,
      state,
      saveAs,
      displayAddress,
      googleMapsAddress,
      updatedAt: new Date()
    };

    // Add customName only if saveAs is "Others"
    if (saveAs === "Others" && customName) {
      updateData.customName = customName;
    } else {
      updateData.customName = undefined; // Remove customName if not "Others"
    }

    // Add coordinates if provided
    if (latitude && longitude) {
      updateData.latitude = parseFloat(latitude);
      updateData.longitude = parseFloat(longitude);
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Address updated successfully",
      address: updatedAddress
    });
  } catch (error) {
    console.error("Error in updateAddress:", error.stack);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  addAddress,
  getAddressesByUser,
  deleteAddress,
  updateAddress
};
