const Rating = require('../../user/model/Rating');
const User = require('../../user/model/User');
const Profile = require('../../user/model/Profile');
const Travel = require('../../user/model/traveldetails');

const submitRating = async (req, res) => {
    const { phoneNumber } = req.params;
    const { message, rate } = req.body;

    try {
        
        const userExists = await User.findOne({ phoneNumber });
        if (!userExists) {
            return res.status(404).json({ message: 'User not found' });
        }

        
        if (!rate || typeof rate !== 'number' || rate < 0 || rate > 5) {
            return res.status(400).json({ message: 'Valid rating (0-5) is required' });
        }

        
        const newRating = new Rating({
            phoneNumber,
            message,
            rate
        });
        await newRating.save();

       
        const profileUpdate = await Profile.findOneAndUpdate(
            { phoneNumber },
            { 
                $push: { userrating: Number(rate) },
                $inc: { totalrating: 1 },
                $set: {
                    averageRating: 0 
                }
            },
            { new: true, upsert: true }
        );

        
        const travelUpdate = await Travel.findOneAndUpdate(
            { phoneNumber },
            { 
                $push: { rating: Number(rate) },
                $inc: { totalrating: 1 },
                $set: {
                    averageRating: 0 
                }
            },
            { new: true, upsert: true }  
        );

       
        const profileRatings = Array.isArray(profileUpdate.userrating) ? profileUpdate.userrating : [];
        const travelRatings = Array.isArray(travelUpdate.rating) ? travelUpdate.rating : [];

        const profileAverageRating = profileRatings.length > 0 
            ? Number((profileRatings.reduce((sum, rating) => sum + Number(rating), 0) / profileRatings.length).toFixed(2))
            : 0;
        const travelAverageRating = travelRatings.length > 0 
            ? Number((travelRatings.reduce((sum, rating) => sum + Number(rating), 0) / travelRatings.length).toFixed(2))
            : 0;

        console.log(`Profile Ratings: ${profileRatings}, Average: ${profileAverageRating}`);
        console.log(`Travel Ratings: ${travelRatings}, Average: ${travelAverageRating}`);

       
        await Profile.updateOne(
            { phoneNumber },
            { 
                $set: { 
                    averageRating: profileAverageRating
                }
            }
        );

       
        await Travel.updateOne(
            { phoneNumber },
            { 
                $set: { 
                    averageRating: travelAverageRating
                }
            }
        );

        return res.status(201).json({ 
            message: "Rating submitted successfully", 
            newRating,
            averageRating: profileAverageRating.toFixed(2)
        });

    } catch (error) {
        console.error("Error submitting rating:", error);
        return res.status(500).json({ 
            message: "Internal server error", 
            error: error.message 
        });
    }
};

module.exports = { submitRating };
