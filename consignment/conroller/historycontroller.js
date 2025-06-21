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

    // 1. Collect all phoneNumbers from traveldetails arrays
    const phoneSet = new Set();
    history.forEach(item => {
      (item.traveldetails || []).forEach(detail => {
        if (detail.phoneNumber) phoneSet.add(detail.phoneNumber);
      });
    });

    const allPhoneNumbers = Array.from(phoneSet);

    // 2. Fetch ratings from Profile
    const profiles = await Profile.find({ phoneNumber: { $in: allPhoneNumbers } }).lean();
    const profileMap = {};
    profiles.forEach(profile => {
      profileMap[profile.phoneNumber] = {
        averageRating: profile.averageRating || 0,
        totalrating: profile.totalrating || 0
      };
    });

    // 3. Add first rating found in traveldetails (if any) to the top level of each history item
    const enrichedHistory = history.map(item => {
      let ratingInfo = {
        averageRating: 0,
        totalrating: 0
      };

      const firstPhone = item.traveldetails?.[0]?.phoneNumber;
      if (firstPhone && profileMap[firstPhone]) {
        ratingInfo = profileMap[firstPhone];
      }

      return {
        ...item,
        ...ratingInfo // adds averageRating, totalrating at top level
      };
    });

    return res.status(200).json({
      message: "Consignment history retrieved successfully",
      history: enrichedHistory
    });

  } catch (error) {
    console.error("Error fetching history:", error.message);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};
