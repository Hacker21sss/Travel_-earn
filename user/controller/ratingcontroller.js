const Rating = require('../../user/model/Rating');
const User = require('../../user/model/User');
const Profile = require('../../user/model/Profile');

const submitRating = async (req, res) => {
    const { phoneNumber } = req.params;
    const { message, rate } = req.body;

    try {
        const userExists = await User.findOne({ phoneNumber });

        if (!userExists) {
            return res.status(404).json({ message: 'User not found' });
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
                $push: { userrating: rate },
                $inc: { totalrating: 1 }
            },
            { new: true, upsert: true }
        );

       
        const ratings = profileUpdate.userrating;
        const averageRating = ratings.length > 0 
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
            : 0;

       
        await Profile.updateOne(
            { phoneNumber },
            { 
                $set: { 
                    averageRating: Number(averageRating.toFixed(2))
                }
            }
        );

        return res.status(201).json({ 
            message: "Rating submitted successfully", 
            newRating,
            averageRating: averageRating.toFixed(2)
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