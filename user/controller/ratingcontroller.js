const Rating = require('../../user/model/Rating');
const User = require('../../user/model/User');
const Profile = require('../../user/model/Profile');
const Travel = require('../../user/model/traveldetails');

const submitRating = async (req, res) => {
    const { phoneNumber } = req.params;
    const { message, rate } = req.body;

    try {
        // Validate user existence
        const userExists = await User.findOne({ phoneNumber });
        if (!userExists) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Validate rating input
        if (!rate || typeof rate !== 'number' || rate < 0 || rate > 5) {
            return res.status(400).json({ message: 'Valid rating (0-5) is required' });
        }

        // Save new rating
        const newRating = new Rating({ phoneNumber, message, rate });
        await newRating.save();

        // Update Profile Ratings
        const profileUpdate = await Profile.findOneAndUpdate(
            { phoneNumber },
            { 
                $push: { userrating: rate },
                $inc: { totalrating: 1 }
            },
            { new: true, upsert: true }
        );

        // Update Travel Ratings
        const travelUpdate = await Travel.findOneAndUpdate(
            { phoneNumber },
            { 
                $push: { userrating: rate },
                $inc: { totalrating: 1 }
            },
            { new: true, upsert: true }
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
            { phoneNumber },
            { $set: { averageRating: profileAverageRating } }
        );

        await Travel.updateOne(
            { phoneNumber },
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
