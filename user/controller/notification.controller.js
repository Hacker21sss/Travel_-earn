const Consignment = require("../../consignment/model/contraveldetails");
const Notification = require("../../user/model/notification");
const earn = require("../../consignment/conroller/consignment.details");
const travel = require("../../user/model/traveldetails");
const notification = require("../../user/model/notification");
const user = require("../../user/model/Profile");
const travelhistory = require("../../user/model/travel.history")

const moment = require("moment");

module.exports.getNotifications = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ status: "error", message: "Phone number is required" });
    }

    console.log("📩 Fetching notifications for:", phoneNumber);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const notifications = await Notification.find({
      requestto: phoneNumber,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!notifications.length) {
      console.log("🔕 No notifications found for:", phoneNumber);
      return res.status(200).json({ status: "success", notifications: [] });
    }


    const formattedNotifications = await Promise.all(
      notifications.map(async (notif) => {
        let notificationData = {};
        const sender = await user.findOne({ phoneNumber: notif.requestedby });
        const receiver = await user.findOne({ phoneNumber: notif.requestto });
        const receivername = receiver?.firstName || "someone";
        const senderName = sender?.firstName || "Someone";
        const consignment = await Consignment.findOne({
          consignmentId: notif.consignmentId,
        });


        if (notif.notificationType === "consignment_request") {
          notificationData = {
            title: "New Consignment Request Comes",
            subtitle: `${senderName || consignment?.username} sent you a consignment request`,
            notificationType: "consignment_request",
            notificationFormat: "consignment",
            time: moment(notif.createdAt).format("h:mm A"),
            consignmentId: notif.consignmentId,
            travelId: notif.travelId,
            requestedby: notif.requestedby,
            requestto: notif.requestto,
            earning: notif.earning || "0",
            travellername: notif.travellername,
            profilepicture: sender?.profilePicture
          };
        } else if (notif.notificationType === "ride_request") {
          notificationData = {
            title: "New Ride Request Comes",
            subtitle: `${senderName} sent you a Ride request`,
            notificationType: "ride_request",
            notificationFormat: "ride",
            time: moment(notif.createdAt).format("h:mm A"),
            consignmentId: notif.consignmentId,
            travelId: notif.travelId,
            requestedby: notif.requestedby,
            requestto: notif.requestto,
            earning: notif.earning || "0",
            travellername: notif.travellername,
            profilepicture: sender?.profilePicture
          };
        }
        else if (notif.notificationType === "ride_accept") {
          notificationData = {
            title: "Ride Request accept",
            subtitle: `you accepted the  Ride request`,
            notificationType: "ride_accept",
            notificationFormat: "ride",
            time: moment(notif.createdAt).format("h:mm A"),
            consignmentId: notif.consignmentId,
            travelId: notif.travelId,
            requestedby: notif.requestedby,
            requestto: notif.requestto,
            earning: notif.earning || "0",
            travellername: notif?.travellername,
            profilepicture: sender?.profilePicture,
            paymentstatus: notif.paymentstatus || "pending"
          };
        }
        else if(notif.notificationType=="consignment_accept" && notif.paymentstatus=="declined"){
          notificationData = {
            title: "Payment declined",
            subtitle: `Payment request has been declined by ${senderName}`,
            notificationType: "consignment_accept",
            notificationFormat: "consignment",
            time: moment(notif.createdAt).format("h:mm A"),
            paymentstatus: notif.paymentstatus || "pending"
          };
        }
        else if(notif.notificationType=="consignment_accept" && notif.paymentstatus=="successful"){
          notificationData = {
            title: "Payment Successful",
            subtitle: `${senderName} has successfully completed the payment`,
            notificationType: "consignment_accept",
            notificationFormat: "consignment",
            time: moment(notif.createdAt).format("h:mm A"),
            paymentstatus: notif.paymentstatus || "pending"
          };
        }

        return notificationData.title ? notificationData : null;
      })
    );

    const filteredNotifications = formattedNotifications.filter(Boolean);

    console.log("🔔 Formatted notifications:", filteredNotifications);
    return res.status(200).json({
      status: "success",
      notifications: filteredNotifications,
    });
  } catch (error) {
    console.error("❌ Error fetching notifications:", error.message);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", error: error.message });
  }
};


exports.getUserNotifications = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const today = moment().startOf("day").toDate();

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ status: "error", message: "Phone number is required" });
    }

    console.log("Fetching notifications for:", phoneNumber);

    // Fetch notifications for the user from today
    const notifications = await Notification.find({
      requestedby: phoneNumber,
      createdAt: { $gte: today },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!notifications.length) {
      console.log("No notifications found for today:", phoneNumber);
      return res.status(200).json({ status: "success", notifications: [] });
    }

    console.log("Found notifications:", notifications.length);

    // Process each notification
    const formattedNotifications = await Promise.all(
      notifications.map(async (notif) => {
        try {
          console.log("Processing notification:", notif._id);

          // Fetch ride and consignment details
          const [rideData, consignmentData] = await Promise.all([
            notif.travelId
              ? travel.findOne({ travelId: notif.travelId }).lean()
              : null,
            notif.consignmentId
              ? Consignment.findOne({
                consignmentId: notif.consignmentId,
              }).lean()
              : null,
          ]);
          const userprofile = await user.findOne({ phoneNumber: notif.requestto }).lean();


          // Fetch sender and receiver names
          const sender = consignmentData
            ? { username: consignmentData.username || "Someone" }
            : { username: "Someone" };
          const receiver = rideData
            ? { username: rideData.username || "Someone" }
            : { username: "Someone" };

          let title, subtitle, notificationType, notificationFormat;

          switch (notif.notificationType) {


            case "ride_accept":
              title = "Ride Approved";
              subtitle = `Your ride request has been approved by ${sender?.username}`;
              notificationType = "ride_accept";
              notificationFormat = "Approval";
              break;

            case "ride_reject":
              title = "Ride Rejected";
              subtitle = `Your ride request was rejected by ${sender?.username}`;
              notificationType = "ride_reject";
              notificationFormat = "Rejection";
              break;

            case "consignment_accept":
              title = "Consignment Accepted";
              subtitle = `Your consignment has been accepted by ${receiver.username}`;
              notificationType = "consignment_accept";
              notificationFormat = "Approval";
              break;

            case "consignment_reject":
              title = "Consignment Rejected";
              subtitle = `Your consignment was rejected by ${receiver.username}`;
              notificationType = "consignment_reject";
              notificationFormat = "Rejection";
              break;

            default:
              console.log("Skipping invalid notification:", notif._id);
              return null;
          }

          return {
            title,
            subtitle,
            notificationType,
            notificationFormat,
            time: notif.createdAt
              ? moment(notif.createdAt).format("h:mm A")
              : "Time not available",
            travelId: notif.travelId || null,
            earning: notif.earning || "0",
            consignmentId: notif.consignmentId || null,
            pickup: notif.pickup,
            dropoff: notif.dropoff,
            requestedby: notif.requestto,
            requestto: notif.requestto,

            travelmode: notif.travelmode,

            travellername: notif.travellername,

            pickuptime: notif.pickuptime,

            dropofftime: notif.dropofftime,
            profilepicture: userprofile?.profilePicture,
            paymentstatus: notif.paymentstatus || "pending"
          };
        } catch (error) {
          console.error("Error processing notification:", error.message);
          return null;
        }
      })
    );

    // Filter out null entries
    const validNotifications = formattedNotifications.filter(
      (notif) => notif !== null
    );

    console.log("Valid notifications:", validNotifications.length);

    return res
      .status(200)
      .json({ status: "success", notifications: validNotifications });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

module.exports.cancelride = async (req, res) => {
  const { phoneNumber, travelId } = req.params;
  const { selectedreason, reasonforcancellation } = req.body;

  try {
    if (!phoneNumber || !travelId || !selectedreason) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const userRecord = await user.findOne({ phoneNumber });
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    const ride = await travel.findOne({ travelId });
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    console.log("Current Ride Status:", ride.status);

    const updatedRide = await travel.findOneAndUpdate(
      { travelId },
      {
        $set: {
          status: "Cancelled",
          reasonforcancellation,
          selectedreason,
        },
      },
      { new: true }
    );

    await notification.updateMany(
      { travelId },
      {
        $set: {
          status: "Cancelled",
          reasonforcancellation,
          selectedreason,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await travelhistory.findOneAndUpdate(
      { travelId },
      { $set: { status: "Cancelled" } },
      { new: true }
    );

    console.log("Updated Ride Status:", updatedRide.status);
    console.log("Cancellation Reason:", updatedRide.reasonforcancellation);

    return res.status(200).json({
      message: "Ride cancelled successfully",
      status: updatedRide.status,
      cancellationReason: updatedRide.reasonforcancellation,
      selectedReason: updatedRide.selectedreason,
    });
  } catch (error) {
    console.error("Error cancelling ride:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports.consignmenttocarryrequest = async (req, res) => {
  const { phoneNumber } = req.params;
  try {
    const user = await notification.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    console.log("Fetching consignment request for:", phoneNumber);
  } catch {
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

//  module. exports.getConsignmentNotifications =async(req, res) => {
//     try {
//       const { phoneNumber } = req.params;

//       if (!phoneNumber) {
//         return res.status(400).json({ message: "Phone number is required" });
//       }

//       const notifications = await Notification.find({ phoneNumber });

//       const consignmentMessages = await Promise.all(
//         notifications.map(async (notif) => {
//           const consignment = await Consignment.findOne({ consignmentId: notif.consignmentId });

//           if (consignment && notif.status=="Accepted") {
//             return {
//               title: "Consignment Approved",
//               subtitle: `Your consignment request has been approved by ${consignment.username}`,
//               time: notif.createdAt ? new Date(notif.createdAt).toLocaleString() : "Time not available",
//             };
//           }

//           return null;
//         })
//       );

//       const filteredMessages = consignmentMessages.filter(Boolean);

//       res.status(200).json(filteredMessages);
//     } catch (error) {
//       console.error("Error fetching consignment notifications:", error);
//       res.status(500).json({ message: "Internal server error" });
//     }
//   };

// exports.getRideNotifications = async (req, res) => {
//   try {
//     const { phoneNumber } = req.params;

//     if (!phoneNumber) {
//       return res.status(400).json({ message: "Phone number is required" });
//     }

//     const notifications = await Notification.find({ phoneNumber });

//     const rideMessages = await Promise.all(
//       notifications.map(async (notif) => {
//         const Travel = await travel.findOne({ rideId: notif.rideId });

//         if (Travel  && notif.status=="Accepted") {
//           return {
//             title: "Ride Approved",
//             subtitle: `Your ride request has been approved ${Travel.username}`,
//             time: notif.createdAt ? new Date(notif.createdAt).toLocaleString() : "Time not available",
//           };
//         }

//         return null;
//       })
//     );

//     const filteredMessages = rideMessages.filter(Boolean);

//     res.status(200).json(filteredMessages);
//   } catch (error) {
//     console.error("Error fetching ride notifications:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

module.exports.updateAllNotifications = async (req, res) => {
  try {
    console.log("Starting to update all notifications...");
    
    // Update notifications where paymentstatus doesn't exist
    const result = await Notification.updateMany(
      { paymentstatus: { $exists: false } },
      { $set: { paymentstatus: "pending" } }
    );

    console.log("Update result:", result);
    
    return res.status(200).json({
      status: "success",
      message: "Successfully updated existing notifications",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update notifications",
      error: error.message
    });
  }
};

