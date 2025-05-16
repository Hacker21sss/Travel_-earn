const User = require("../user/model/User");
const Consignment = require("../consignment/model/contraveldetails");
const TravelHistory = require("../user/model/travel.history");
const Travel = require("../user/model/traveldetails");
const Notification = require("../user/model/notification");
const moment = require("moment");
const RequestForCarry = require("../user/model/requestforcarry");
const RideRequest = require("../consignment/model/riderequest");
const ConsignmentHistory = require("../consignment/model/conhistory");
const ConsignmentToCarry = require("../traveller/model/consignmenttocarry");
const traveldetails = require("../user/model/traveldetails");
const axios = require("axios");
const { getIO } = require("../socket");

const socket = require("../socket");
const traveller = require("../traveller/model/traveller");



module.exports.respondToRideRequest = async (req, res) => {
  try {
    let { consignmentId, travelId } = req.query;
    const { response } = req.body;

    if (!travelId || !response) {
      return res
        .status(400)
        .json({ message: "travelId and response are required" });
    }

    if (!consignmentId) {
      const rideRequest = await RideRequest.findOne({ travelId });
      if (rideRequest && rideRequest.consignmentId) {
        consignmentId = rideRequest.consignmentId;
      } else {
        const travel = await Travel.findOne({ travelId });
        // if (travel && travel.consignmentId) {
        //   consignmentId = travel.consignmentId;
        // }
      }
      if (!consignmentId) {
        return res
          .status(400)
          .json({ message: "consignmentId not found or derivable" });
      }
    }

    const consignment = await Consignment.findOne({ consignmentId });
    if (!consignment) {
      return res.status(404).json({ message: "Consignment not found" });
    }

    const rideRequest = await RideRequest.findOne({ travelId });
    if (!rideRequest) {
      return res.status(404).json({ message: "Ride request not found" });
    }

    if (
      rideRequest &&
      ["Accepted", "Rejected", "Expired"].includes(rideRequest.status)
    ) {
      return res
        .status(400)
        .json({ message: `Ride already ${rideRequest.status.toLowerCase()}` });
    }

    // Check if consignmentId already exists in TravelHistory
    const travelHistory = await TravelHistory.findOne({
      travelId,
      "consignmentDetails.consignmentId": consignmentId,
    });
    if (travelHistory) {
      return res
        .status(400)
        .json({ message: "Consignment already accepted for this travelId" });
    }

    if (moment().isAfter(moment(rideRequest.createdAt).add(369, "minutes"))) {
      await Promise.all([
        Travel.updateOne({ travelId }, { $set: { status: "Expired" } }),
        Notification.updateOne(
          { travelId },
          { $set: { status: "Expired" } }
        ),
      ]);
      return res.status(400).json({ message: "Ride request has expired." });
    }

    if (response.toLowerCase() === "accept") {
      const senderOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const receiverOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const message =`Please use OTP ${senderOtp} to Collect the Consignment from the Traveler after checking the Package. Do not share the OTP over phone. Regards, Timestrings System Pvt. Ltd`;
      const message1=`Please use OTP ${receiverOtp} to accept the Consignment from the Sender after checking the Package. Do not share the OTP over phone. Regards, Timestrings System Pvt. Ltd.`;

     try {
const [smsResponse, smsResponse1] = await Promise.all([
  (async () => {
    const formData = new FormData();
    formData.append('userid', 'timestrings');
    formData.append('password', 'X82w2G4f');
    formData.append('mobile', consignment.phoneNumber);
    formData.append('senderid', 'TMSSYS');
    formData.append('dltEntityId', '1701173330327453584');
    formData.append('msg', message);
    formData.append('sendMethod', 'quick');
    formData.append('msgType', 'text');
    formData.append('dltTemplateId', '1707173408029753777');
    formData.append('output', 'json');
    formData.append('duplicatecheck', 'true');
    formData.append('dlr', '1');

    const response = await axios({
      method: 'post',
      url: 'https://app.pingbix.com/SMSApi/send',
      headers: {
        'Cookie': 'SERVERID=webC1',
      },
      data: formData,
      maxBodyLength: Infinity,
    });

    console.log("✅ API Response (smsResponse):", response.data);
    return response;
  })(),
  (async () => {
    const formData = new FormData();
    formData.append('userid', 'timestrings');
    formData.append('password', 'X82w2G4f');
    formData.append('mobile', consignment.recieverphone);
    formData.append('senderid', 'TMSSYS');
    formData.append('dltEntityId', '1701173330327453584');
    formData.append('msg', message1);
    formData.append('sendMethod', 'quick');
    formData.append('msgType', 'text');
    formData.append('dltTemplateId', '1707173408034076405');
    formData.append('output', 'json');
    formData.append('duplicatecheck', 'true');
    formData.append('dlr', '1');

    const response = await axios({
      method: 'post',
      url: 'https://app.pingbix.com/SMSApi/send',
      headers: {
        'Cookie': 'SERVERID=webC1',
      },
      data: formData,
      maxBodyLength: Infinity,
    });

    console.log("✅ API Response (smsResponse1):", response.data);
    return response;
  })(),
]);

if (smsResponse.status !== 200 || smsResponse1.status !== 200) {
  return res
    .status(500)
    .json({ message: "Failed to send OTP via SMS. Please try again." });
}
console.log("SMS Sent Successfully:", smsResponse.data, smsResponse1.data);
} catch (error) {
  console.error("Failed to send OTP:", error.message);
  return res
    .status(500)
    .json({ message: "Failed to send OTP via SMS", error: error.message });
}

      await Promise.all([
        Travel.updateOne({ travelId }, { $set: { status: "Accepted" } }),
        Consignment.updateOne(
          { consignmentId },
          { $set: { sotp: senderOtp, rotp: receiverOtp } }
        ),
        new ConsignmentToCarry({
          phoneNumber: rideRequest.phoneNumber,
          consignmentId,
          travelId: rideRequest.travelId,
          sender: consignment.username,
          senderphone: consignment.phoneNumber,
          startinglocation: consignment.startinglocation,
          droplocation: consignment.goinglocation,
          receiver: consignment.recievername,
          earning: rideRequest.earning,
          receiverphone: consignment.recieverphone,
          dateandtimeofdelivery:rideRequest.expectedendtime,
          weight: parseFloat(consignment.weight), // Standardized as number
          dimensions: consignment.dimensions,
          status: "Yet to Collect",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).save(),
        ConsignmentHistory.updateOne(
          { consignmentId },
          {
            $set: { status: "Yet to Collect",sotp: senderOtp, rotp: receiverOtp },
            $push: {
              traveldetails: {
                username: rideRequest.rider,
                travelId: rideRequest.travelId,
                travelMode: rideRequest.travelMode,
                rideId: rideRequest.rideId,
                phoneNumber: rideRequest.phoneNumber,
                timestamp: new Date().toISOString(),
                rating:rideRequest.rating,
                totalrating:rideRequest.totalrating
              },
            },
          },
          { upsert: true }
        ),
        TravelHistory.updateOne(
          { travelId: rideRequest.travelId },
          {
            $inc: { consignments: 1 },
            $push: {
              consignmentDetails: {
                consignmentId,
                status: "UPCOMING",
                pickup: consignment.startinglocation,
                drop: consignment.goinglocation,
                weight: parseFloat(consignment.weight), // Standardized as number
                timestamp: new Date().toISOString(),
              },
            },
          },
          { upsert: true }
        ),
      ]);

      const notification = new Notification({
        travelId: rideRequest.travelId,
        consignmentId:rideRequest.consignmentId,
        requestedby: rideRequest.phoneNumber,
        requestto:consignment.phoneNumber,
        status: "Accepted",
        notificationType: "ride_accept",
handleWithCare:consignment.handleWithCare,
specialRequest:consignment.specialRequest,
dateOfSending:consignment.dateOfSending,
durationAtEndPoint:consignment.durationAtEndPoint,
        createdAt: new Date(),
        earning:rideRequest.earning,
        pickup:consignment.startinglocation,
        dropoff:consignment.goinglocation,
        travelmode:rideRequest.travelMode,
        travellername:rideRequest.rider,
        // pickuptime:travelHistory.expectedStartTime,
        dropofftime:rideRequest.expectedendtime
      });
      await notification.save();
    

      let io = getIO();
      io.emit("bookingAccepted", { travelId, consignmentId });

      return res.status(200).json({
        message: "Ride accepted",
        travelId: rideRequest.travelId,
        senderOtp,
        receiverOtp,
      });
    } else if (response.toLowerCase() === "reject") {
      const travelDetails = await Travel.findOne({ travelId });
      if (!travelDetails) {
        return res.status(404).json({ message: "Ride not found" });
      }

      const notification = new Notification({
        travelId,
        consignmentId,
        requestedby: rideRequest.phoneNumber,
        status: "Rejected",
        notificationType: "ride_reject",
        createdAt: new Date(),
      });

      await Promise.all([
        Travel.updateOne({ travelId }, { $set: { status: "Rejected" } }),
        notification.save(),
      ]);

      let io = getIO();
      io.emit("bookingrejected", { travelId, consignmentId });

      return res.status(200).json({ message: "Ride rejected" });
    } else {
      return res
        .status(400)
        .json({ message: "Invalid response. Use 'accept' or 'reject'." });
    }
  } catch (error) {
    console.error("Server error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

module.exports.respondToConsignmentRequest = async (req, res) => {
  try {
    const { travelId, consignmentId } = req.query;
    const { response } = req.body;

    if (!travelId || !consignmentId || !response) {
      return res.status(400).json({
        message: "travelId, consignmentId, and response are required"
      });
    }

    const [book, consignment, travelHistory, travelHistoryBasic] = await Promise.all([
      RequestForCarry.findOne({ travelId, consignmentId }),
      Consignment.findOne({ consignmentId }),
      TravelHistory.findOne({
        travelId,
        "consignmentDetails.consignmentId": consignmentId,
      }),
      TravelHistory.findOne({ travelId }),
    ]);

    if (!book) return res.status(404).json({ message: "Request not found" });
    if (!consignment) return res.status(404).json({ message: "Consignment not found" });
    if (travelHistory) return res.status(400).json(["already accepted"]);
    if (!travelHistoryBasic)
      return res.status(404).json({ message: "Travel history not found for the given travelId" });

    if (
      ["Accepted", "Rejected", "Expired"].includes(book.status) ||
      ["Accepted", "Rejected", "Expired"].includes(consignment.status)
    ) {
      return res.status(400).json({
        message: `This consignment has already been ${book.status || consignment.status}.`,
      });
    }

    if (response.toLowerCase() === "accept") {
      // Generate OTPs
      const senderOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const receiverOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const senderMsg = `Please use OTP ${senderOtp} to Collect the Consignment from the Traveler after checking the Package. Do not share the OTP over phone. Regards, Timestrings System Pvt. Ltd`;
      const receiverMsg = `Please use OTP ${receiverOtp} to accept the Consignment from the Sender after checking the Package. Do not share the OTP over phone. Regards, Timestrings System Pvt. Ltd.`;

      try {
const [smsResponse, smsResponse1] = await Promise.all([
  (async () => {
    const formData = new FormData();
    formData.append('userid', 'timestrings');
    formData.append('password', 'X82w2G4f');
    formData.append('mobile', consignment.phoneNumber);
    formData.append('senderid', 'TMSSYS');
    formData.append('dltEntityId', '1701173330327453584');
    formData.append('msg', senderMsg);
    formData.append('sendMethod', 'quick');
    formData.append('msgType', 'text');
    formData.append('dltTemplateId', '1707173408029753777');
    formData.append('output', 'json');
    formData.append('duplicatecheck', 'true');
    formData.append('dlr', '1');

    const response = await axios({
      method: 'post',
      url: 'https://app.pingbix.com/SMSApi/send',
      headers: {
        'Cookie': 'SERVERID=webC1',
      },
      data: formData,
      maxBodyLength: Infinity,
    });

    console.log("✅ API Response (smsResponse):", response.data);
    return response;
  })(),
  (async () => {
    const formData = new FormData();
    formData.append('userid', 'timestrings');
    formData.append('password', 'X82w2G4f');
    formData.append('mobile', consignment.recieverphone);
    formData.append('senderid', 'TMSSYS');
    formData.append('dltEntityId', '1701173330327453584');
    formData.append('msg', receiverMsg);
    formData.append('sendMethod', 'quick');
    formData.append('msgType', 'text');
    formData.append('dltTemplateId', '1707173408034076405');
    formData.append('output', 'json');
    formData.append('duplicatecheck', 'true');
    formData.append('dlr', '1');

    const response = await axios({
      method: 'post',
      url: 'https://app.pingbix.com/SMSApi/send',
      headers: {
        'Cookie': 'SERVERID=webC1',
      },
      data: formData,
      maxBodyLength: Infinity,
    });

    console.log("✅ API Response (smsResponse1):", response.data);
    return response;
  })(),
]);

if (smsResponse.status !== 200 || smsResponse1.status !== 200) {
  return res
    .status(500)
    .json({ message: "Failed to send OTP via SMS. Please try again." });
}
console.log("SMS Sent Successfully:", smsResponse.data, smsResponse1.data);
} catch (error) {
  console.error("Failed to send OTP:", error.message);
  return res
    .status(500)
    .json({ message: "Failed to send OTP via SMS", error: error.message });
}

      // Save and update documents
      const results = await Promise.all([
        new ConsignmentToCarry({
          phoneNumber: book.phoneNumber,
          consignmentId,
          travelId: book.travelId,
          sender: consignment.username,
          senderphone: consignment.phoneNumber,
          startinglocation: consignment.startinglocation,
          droplocation: consignment.goinglocation,
          receiver: consignment.recievername,
          earning: book.earning,
          receiverphone: consignment.recieverphone,
          weight: parseFloat(consignment.weight),
          dimensions: consignment.dimensions,
          status: "Yet to Collect",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).save(),

        Consignment.updateOne(
          { consignmentId },
          {
            $set: {
              status: "Yet to Collect",
              sotp: senderOtp,
              rotp: receiverOtp,
            },
          }
        ),

        RequestForCarry.updateOne(
          { consignmentId, travelId },
          { $set: { status: "Accepted" } }
        ),

        ConsignmentHistory.updateOne(
          { consignmentId },
          {
            $set: {
              status: "Yet to Collect",
              sotp: senderOtp,
              rotp: receiverOtp,
              consignmentpickuptime: travelHistoryBasic.expectedStartTime,
              consignmentdelivertime: travelHistoryBasic.expectedendtime,
            },
            $push: {
              traveldetails: {
                travelId: book.travelId,
                username: book.travellername || "Unknown",
                travelMode: book.travelmode,
                rideId: book.rideId,
                phoneNumber: book.phoneNumber,
                timestamp: new Date().toISOString(),
              },
            },
          },
          { upsert: true }
        ),

        TravelHistory.updateOne(
          { travelId },
          {
            $inc: { consignments: 1 },
            $push: {
              consignmentDetails: {
                consignmentId: consignment.consignmentId,
                status: "UPCOMING",
                pickup: consignment.startinglocation,
                drop: consignment.goinglocation,
                weight: parseFloat(consignment.weight),
                timestamp: new Date().toISOString(),
              },
            },
          },
          { upsert: true }
        ),
      ]);

      // Create Notification
      const notification = new Notification({
        consignmentId,
        requestedby: consignment.phoneNumber,
        requestto: book.phoneNumber,
        status: "Accepted",
        notificationType: "consignment_accept",
        earning: book.earning,
        handleWithCare: consignment.handleWithCare,
        specialRequest: consignment.specialRequest,
        dateOfSending: consignment.dateOfSending,
        durationAtEndPoint: consignment.durationAtEndPoint,
        createdAt: new Date(),
        travelId: book.travelId,
        pickup: consignment.startinglocation,
        dropoff: consignment.goinglocation,
        travelmode: book.travelmode,
        travellername: book.travellername,
        pickuptime: travelHistoryBasic.expectedStartTime,
        dropofftime: travelHistoryBasic.expectedendtime,
      });

      await notification.save();

      // Emit Socket Event
      getIO().emit("bookingAccepted", { travelId, consignmentId });

      return res.status(200).json({
        message: "Consignment accepted",
        senderOtp,
        receiverOtp
      });

    } else if (response.toLowerCase() === "reject") {
      await Promise.all([
        Consignment.updateOne({ consignmentId }, { $set: { status: "Rejected" } }),
        RequestForCarry.updateOne({ consignmentId, travelId }, { $set: { status: "Rejected" } }),
        new Notification({
          consignmentId,
          requestedby: consignment.phoneNumber,
          notificationType: "consignment_reject",
          status: "Rejected",
          createdAt: new Date(),
          travelId: book.travelId,
        }).save(),
      ]);

      getIO().emit("bookingrejected", { travelId, consignmentId });

      return res.status(200).json({ message: "Consignment request rejected" });
    } else {
      return res.status(400).json({ message: "Invalid response. Use 'accept' or 'reject'." });
    }

  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports.getRideStatus = async (req, res) => {
  try {
    const { travelId } = req.params;

    if (!travelId) {
      return res.status(200).json({
        error: "rideId is required",
      });
    }

    const ride = await Travel.findOne({ travelId });

    if (!ride) {
      return res.status(200).json({
        error: "Ride not found",
      });
    }

    const statusSteps = [
      {
        step: "Ride Started",
        completed: !!ride.startedat,
        updatedat: ride.startedat
          ? `${ride.startedat.date} ${ride.startedat.time}`
          : undefined,
      },
      {
        step: "Ride In Progress",
        completed: ride.startedat && ride.status !== "completed",
        updatedat:
          ride.startedat && ride.status !== "completed"
            ? `${ride.startedat.date} ${ride.startedat.time}`
            : undefined,
      },
      {
        step: "Ride Completed",
        completed: ride.status === "completed" && !!ride.endedat,
        updatedat: ride.endedat
          ? `${ride.endedat.date} ${ride.endedat.time}`
          : undefined,
      },
    ];

    res.status(200).json({
      status: statusSteps,
    });
  } catch (error) {
    console.error("Error fetching ride status:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};
