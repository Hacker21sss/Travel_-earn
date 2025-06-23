const razorpayInstance = require("../config/payment.config");
const crypto = require("crypto");
const Earning=require('../../traveller/model/Earning');
const notification=require('../../user/model/notification')




const createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;
    
 
    if (!amount || !currency) {
      console.error("Missing amount or currency:", req.body);
      return res.status(400).json({ success: false, message: "Amount and currency are required." });
    }

    
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error("Invalid amount:", amount);
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

  
    if (currency !== "INR") {
      console.error("Unsupported currency:", currency);
      return res.status(400).json({ success: false, message: "Only INR is supported." });
    }

    const options = {
      amount: Math.round(amountNum), 
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        purpose: "Consignment payment",
        created_at: new Date().toISOString(),
      },
    };

    console.log("Creating Razorpay order with options:", options);
    const order = await razorpayInstance.orders.create(options);
    console.log("Order created successfully:", order.id);

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: "Failed to create order", error: error.message });
  }
};
const verifyOrder = async (req, res) => {
  const session = await Earning.startSession();
  session.startTransaction();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      phoneNumber,
      amount,
      travelId,
      title = "Ride Payment",
    } = req.body;

    // Input Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("Missing required fields:", req.body);
      return res.status(400).json({ success: false, message: "Missing required payment or earning data" });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error("Invalid amount:", amount);
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    if (!phoneNumber) {
      console.error("Invalid phoneNumber:", phoneNumber);
      return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    // Create new transaction (matches schema)
    const newTransaction = {
      title,
      travelId: travelId || "N/A",
      amount: amountNum,
      paymentMethod: "Online",
      paymentId: razorpay_payment_id,
      status: "In Progress",
      timestamp: new Date(),
    };

    console.log("Adding in-progress transaction for:", phoneNumber, newTransaction);

    const updateResult = await Earning.updateOne(
      { phoneNumber },
      { $push: { transactions: newTransaction } },
      { upsert: true, session }
    );
    console.log("Inserted transaction:", updateResult);

    // Signature Verification
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      console.error("Invalid signature:", { razorpay_signature, generated_signature });

      const failedUpdate = await Earning.updateOne(
        { phoneNumber, "transactions.paymentId": razorpay_payment_id },
        { $set: { "transactions.$.status": "Failed" } },
        { session }
      );
      console.log("Marked transaction as Failed:", failedUpdate);

      await session.commitTransaction();
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
    const note = await notification.updateMany(
      {travelId},
      {
        $set:{"paymentstatus":"successful"}
      }
    )
    
    console.log(note);
    const completedUpdate = await Earning.updateOne(
      { phoneNumber, "transactions.paymentId": razorpay_payment_id },
      {
        $set: { "transactions.$.status": "Completed" },
        $inc: { totalEarnings: amountNum }
      },
      { session }
    );
    console.log("Marked transaction as Completed:", completedUpdate);
    
    console.log("Marked transaction :",note);
    await session.commitTransaction();
    console.log("Payment verified successfully for:", razorpay_payment_id);

    const newNotification = new notification({
          phoneNumber: phoneNumber,
          requestto: con.phoneNumber,
          requestedby: phoneNumber,
          consignmentId: con.consignmentId,
          earning: expectedEarning,
          travelId: Ride.travelId,
          notificationType: "ride_request"
        });
    
    await newNotification.save(); 

    res.status(200).json({
      success: true,
      message: "Payment successful"
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error verifying payment:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Something went wrong", error: error.message });
  } finally {
    session.endSession();
  }
};

// Handle WebView response for frontend
const handleRazorpayResponse = async (req, res) => {
  try {
    const { order_id, payment_id, signature, status } = req.query;

    // Validate inputs
    if (!order_id || !payment_id) {
      console.error("Missing order_id or payment_id:", req.query);
      return res.status(400).json({ msg: "error", message: "Missing payment details" });
    }

    if (status === "cancelled") {
      console.log("Payment cancelled:", { order_id, payment_id });
      return res.status(200).json({ msg: "cancelled", message: "Payment was cancelled" });
    }

    if (!signature) {
      console.error("Missing signature:", req.query);
      return res.status(400).json({ msg: "error", message: "Signature required for verification" });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${order_id}|${payment_id}`)
      .digest("hex");

    if (generated_signature === signature) {
      console.log("Payment verified successfully:", { order_id, payment_id });
      return res.status(200).json({ msg: "success", message: "Payment verified successfully" });
    }

    console.error("Invalid signature in response:", { order_id, payment_id, signature });
    return res.status(400).json({ msg: "error", message: "Invalid payment signature" });
  } catch (error) {
    console.error("Error in razorpay response:", error.message, error.stack);
    return res.status(500).json({ msg: "error", message: "Server error" });
  }
};

module.exports = {
  createOrder,
  verifyOrder,
  handleRazorpayResponse,
};