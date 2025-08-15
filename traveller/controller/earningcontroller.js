
const User = require('../../user/model/User');
const Earning = require("../../traveller/model/Earning"); // adjust path if needed
// adjust the path to your model

module.exports.getEarnings = async (req, res) => {
    try {
        let { phoneNumber } = req.query;

      
        phoneNumber = decodeURIComponent(phoneNumber || "").trim();
        if (!phoneNumber.startsWith("+")) {
            phoneNumber = `+${phoneNumber}`;
        }

        console.log("Decoded Phone Number:", phoneNumber);

        if (!phoneNumber) {
            return res.status(400).json({
                status: "error",
                message: "Phone number is required"
            });
        }

        
        const earningData = await Earning.findOne({ phoneNumber });

        if (!earningData) {
            return res.status(200).json({
                status: "success",
                totalEarnings: 0,
                message: "No earnings till now",
                data: []
            });
        }

        // Define statuses to include in totalEarnings (e.g., only "completed" or include "In Progress")
        const validStatuses = ["completed"]; // Add "in progress" if needed
        const completedTransactions = earningData.transactions.filter(
            transaction => validStatuses.includes(transaction.status?.trim().toLowerCase())
        );

        
        const totalEarnings = completedTransactions.reduce(
            (sum, transactions) => {
                const amount = parseFloat(transactions.totalFare);
                return isNaN(amount) ? sum : sum + amount;
            },
            0
        );
        console.log(completedTransactions)
        return res.status(200).json({
            status: "success",
            totalEarnings: totalEarnings.toFixed(2), // Ensure two decimal places
            data: completedTransactions.map(transaction => ({
                date: transaction.timestamp.toISOString().split("T")[0],
                amount: parseFloat(transaction.totalFare).toFixed(2), // Ensure two decimal places
                paymentId: transaction.paymentId,
                title: transaction.title,
                travelId: transaction.travelId,
                status: transaction.status,
                method: transaction.paymentMethod
            }))
        });

    } catch (error) {
        console.error("Error fetching earnings:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error",
            error: error.message
        });
    }
};
