const Address = require("../../traveller/model/address1");

// Controller to add a new address
const addAddress = async (req, res) => {
  try {
    const { phoneNumber,location, pincode, flat, street, landmark, city, state, saveAs } = req.body;

    // Check if the address already exists
    // const existingAddress = await Address.find({
      
      
     
    //   flat,
     
    //   landmark,
      
    
      
    // });

    // if (existingAddress) {
    //   return res.status(400).json({ message: "Address already exists" });
    // }

    // Save the new address
    const address = new Address(req.body);
    await address.save();
    res.status(201).json({
      message: "Address saved successfully",
      address,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
};
