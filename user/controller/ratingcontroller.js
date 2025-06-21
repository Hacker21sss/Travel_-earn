const Rating = require('../../user/model/Rating');
const User = require('../../user/model/User');
const Profile = require('../../user/model/Profile');
const Travel = require('../../user/model/traveldetails');

const fixedUserRatings = async () => {
  const profiles = await Profile.find({});
  for (const profile of profiles) {
    if (!Array.isArray(profile.userrating)) {
      await Profile.updateOne(
        { _id: profile._id },
        { $set: { userrating: [Number(profile.userrating)] } }
      );
      console.log(`✅ Fixed Profile: ${profile._id}`);
    } else if (Array.isArray(profile.userrating[0])) {
      await Profile.updateOne(
        { _id: profile._id },
        { $set: { userrating: profile.userrating.flat() } }
      );
      console.log(`✅ Flattened Profile: ${profile._id}`);
    }
  }

  const travels = await Travel.find({});
  for (const travel of travels) {
    if (!Array.isArray(travel.userrating)) {
      await Travel.updateOne(
        { _id: travel._id },
        { $set: { userrating: [Number(travel.userrating)] } }
      );
      console.log(`✅ Fixed Travel: ${travel._id}`);
    } else if (Array.isArray(travel.userrating[0])) {
      await Travel.updateOne(
        { _id: travel._id },
        { $set: { userrating: travel.userrating.flat() } }
      );
      console.log(`✅ Flattened Travel: ${travel._id}`);
    }
  }

  console.log("✅ All userrating fields fixed.");
};



const submitRating = async (req, res) => {
    const { phoneNumber } = req.params;
    const { message, rate, tPhoneNumber } = req.body;
    console.log(phoneNumber)
    console.log(req.body)

    try {
        // Validate user existence
        await fixedUserRatings();
        const userExists = await User.findOne({ phoneNumber : tPhoneNumber });
        console.log(userExists)
        if (!userExists) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Validate rating input
        // if (!rate || typeof rate !== 'number' || rate < 0 || rate > 5) {
        //     return res.status(400).json({ message: 'Valid rating (0-5) is required' });
        // }

        const numericRate = Number(rate);
        if (!numericRate || typeof numericRate !== 'number' || numericRate < 0 || numericRate > 5) {
            return res.status(400).json({ message: 'Valid rating (0-5) is required' });
        }
        // Save new rating
        const newRating = new Rating({ tPhoneNumber, phoneNumber, message, numericRate });
        await newRating.save();

        // Update Profile Ratings
        const profileUpdate = await Profile.findOneAndUpdate(
            { phoneNumber: tPhoneNumber },
            {
                $push: { userrating: numericRate },
                $inc: { totalrating: 1 }
            },
            { new: true}
        );

        // Update Travel Ratings
        const travelUpdate = await Travel.findOneAndUpdate(
            { phoneNumber: tPhoneNumber },
            {
                $push: { userrating: numericRate },
                $inc: { totalrating: 1 }
            },
            { new: true}
        );

        // Convert userrating and rating to arrays safely
        const profileRatings = Array.isArray(profileUpdate.userrating)
            ? profileUpdate.userrating.map(Number).filter(r => !isNaN(r))
            : Object.values(profileUpdate.userrating || {}).map(Number).filter(r => !isNaN(r));

        const travelRatings = Array.isArray(travelUpdate.userrating)
            ? travelUpdate.userrating.map(Number).filter(r => !isNaN(r))
            : Object.values(travelUpdate.userrating || {}).map(Number).filter(r => !isNaN(r));

        // Calculate average ratings
        const profileAverageRating = profileRatings.length > 0
            ? Number((profileRatings.reduce((sum, rating) => sum + rating, 0) / profileRatings.length).toFixed(2))
            : 0;

        const travelAverageRating = travelRatings.length > 0
            ? Number((travelRatings.reduce((sum, rating) => sum + rating, 0) / travelRatings.length).toFixed(2))
            : 0;

        // Debugging Logs
        console.log(`Profile Ratings: ${profileRatings}, Average: ${profileAverageRating}`);
        console.log(`Travel Ratings: ${travelRatings}, Average: ${travelAverageRating}`);

        // Update averageRating fields
        await Profile.updateOne(
            { phoneNumber: tPhoneNumber },
            { $set: { averageRating: profileAverageRating } }
        );

        await Travel.updateOne(
            { phoneNumber: tPhoneNumber },
            { $set: { averageRating: travelAverageRating } }
        );

        return res.status(201).json({
            message: "Rating submitted successfully",
            newRating,
            totalRatings: profileUpdate.totalrating,
            averageRating: profileAverageRating.toFixed(2)
        });

    } catch (error) {
        console.error("Error submitting rating:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


module.exports = { submitRating };
