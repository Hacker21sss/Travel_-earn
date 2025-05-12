const ordermodel=require('../../user/model/notification')



module.exports.getorder = async (req, res) => {
    const { phoneNumber } = req.params;

    try {
        const orders = await ordermodel.find(
            { phoneNumber },
            { earning: 1, status: 1, pickup: 1, drop: 1, travelId: 1, _id: 0 }
        );

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No orders found for this user" });
        }

        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching order history:", error.message);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
