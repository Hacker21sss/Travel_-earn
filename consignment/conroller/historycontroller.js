const ConsignmentRequestHistory = require('../../consignment/model/conhistory');
const Profile = require('../../user/model/Profile');

module.exports.getConsignmentHistory = async (req, res) => {
  try {
    const { PhoneNumber } = req.params;

    console.log("Fetching history for PhoneNumber:", PhoneNumber);

    const history = await ConsignmentRequestHistory.find({ ownerPhoneNumber: PhoneNumber }).sort({ createdAt: -1 }).lean();

    if (!history || history.length === 0) {
      return res.status(404).json({
        message: "No consignment history found for this phone number."
      });
    }
    console.log(history[0])
    return res.status(200).json({
      message: "Consignment history retrieved successfully",
      history
    });

  } catch (error) {
    console.error("Error fetching history:", error.message);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};
