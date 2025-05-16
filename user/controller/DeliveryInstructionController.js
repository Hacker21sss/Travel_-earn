const Instruction = require('../model/DeliveryInstruction');
const Notification = require('../../user/model/notification');
const User = require('../../user/model/Profile');
const consignment = require('../../consignment/model/contraveldetails');
const earning=require('../../traveller/model/Earning');
const consignmenthistory=require('../../consignment/model/conhistory')
const travelhistory=require('../../user/model/travel.history')
const currentime=require('../../service/getcurrentdatetime')
const riderequest=require('../../consignment/model/riderequest');
const traveldetails = require('../model/traveldetails');
const consignmenttocarry=require('../../traveller/model/consignmenttocarry');
const { getIO } = require("../../socket");
const mongoose = require('mongoose');



const moment = require("moment");
const getCurrentDateTime = () => new Date().toISOString();
  
  const pickupconsignment = async (req, res) => {
    try {
      const { travelId, consignmentId } = req.query;
      const { status, otp,ltd,lng } = req.body;
  
      // Validate required parameters
      if (!travelId || !consignmentId || !status) {
        return res
          .status(400)
          .json({ message: "Missing travelId, consignmentId, or status" });
      }
      
      // Validate MongoDB ObjectIds
      if (!mongoose.Types.ObjectId.isValid(travelId) || !mongoose.Types.ObjectId.isValid(consignmentId)) {
        return res.status(400).json({ message: "Invalid travelId or consignmentId format" });
      }
  
      // Validate status type and value
      if (typeof status !== 'string') {
        return res.status(400).json({ message: "Status must be a string" });
      }
  
      const validStatuses = ['pending', 'collected', 'completed'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({ message: "Invalid status value" });
      }
  
      // Validate coordinates for pickup
      if (status.toLowerCase() === "collected" || status.toLowerCase() === "pending") {
        const latitude = parseFloat(ltd);
        const longitude = parseFloat(lng);
        
        if (isNaN(latitude) || isNaN(longitude)) {
          return res.status(400).json({ message: "Invalid coordinates format" });
        }
        
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          return res.status(400).json({ message: "Coordinates out of valid range" });
        }
      }
  
      // Validate OTP type
      if (typeof otp !== 'string' && typeof otp !== 'number') {
        return res.status(400).json({ message: "Invalid OTP format" });
      }
  
      // Find consignment to carry
      const consignmentToCarry = await consignmenttocarry.findOne({ consignmentId });
      if (!consignmentToCarry) {
        return res.status(404).json({ message: "Consignment not found" });
      }
  
      // Find main consignment details
      const Consignment = await consignment.findOne({ consignmentId });
      if (!Consignment) {
        return res.status(404).json({ message: "Consignment details not found" });
      }
  
      // Find travel details
      const travel = await traveldetails.findOne({ travelId });
      if (!travel) {
        return res.status(404).json({ message: "Travel not found" });
      }
  
      // Check travel status
      if (travel.status !== "started") {
        return res
          .status(400)
          .json({ message: "Cannot pick up consignment before starting the travel" });
      }
  
      // Validate OTP
      if (otp !== Consignment.sotp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }
  
      // Determine new status
      let newStatus;
      switch (status.toLowerCase()) {
        case "pending":
          newStatus = "Collected";
          break;
        case "collected":
          newStatus = "on the way";
          break;
        case "completed":
          newStatus = "Delivered";
          break;
        default:
          return res.status(400).json({ message: "Invalid status transition" });
      }
  
      const pickupTime = getCurrentDateTime();
  
      // Update consignment history
      const pickupLocation = (status.toLowerCase() === "collected" || status.toLowerCase() === "pending") ? {
        lat: parseFloat(ltd),
        lng: parseFloat(lng)
      } : null;

      // Ensure location values are valid before updating
      if (pickupLocation && (isNaN(pickupLocation.lat) || isNaN(pickupLocation.lng))) {
        return res.status(400).json({ message: "Invalid location coordinates" });
      }

      // Update ConsignmentRequestHistory with type-safe location
      const updateResult = await consignmenthistory.updateOne(
        { consignmentId },
        {
          $set: {
            status: newStatus,
            collected: pickupTime,
            ...(pickupLocation && {
              pickupLocation: {
                lat: Number(pickupLocation.lat),
                lng: Number(pickupLocation.lng)
              }
            }),
          },
          $push: {
            traveldetails: {
              travelMode: travel.travelMode,
              username: travel.username,
              rideId: travel.rideId,
              travelId,
              phoneNumber: travel.phoneNumber,
              timestamp: new Date(),
            },
          },
        },
        { upsert: true }
      );

      // Update consignment to carry with type-safe location
      const updateResult1 = await consignmenttocarry.updateOne(
        { travelId, consignmentId },
        {
          $set: {
            status: newStatus,
            consignmentpickuptime: pickupTime,
            ...(pickupLocation && {
              pickupLocation: {
                lat: Number(pickupLocation.lat),
                lng: Number(pickupLocation.lng)
              }
            }),
          },
        },
        { upsert: true }
      );

      // Update travelhistory with type-safe location
      const updateResult2 = await travelhistory.updateOne(
        { travelId, "consignmentDetails.consignmentId": consignmentId },
        {
          $set: {
            status: "STARTED",
            "consignmentDetails.$.status": newStatus === "Collected" ? "on the way" : newStatus,
            ...(pickupLocation && {
              liveLocation: {
                lat: Number(pickupLocation.lat),
                lng: Number(pickupLocation.lng),
                timestamp: new Date(),
              },
            }),
          },
          $push: {
            ...(pickupLocation && {
              locationHistory: {
                lat: Number(pickupLocation.lat),
                lng: Number(pickupLocation.lng),
                timestamp: new Date(),
              },
            }),
          },
        },
        { upsert: true }
      );

      if (
        updateResult.modifiedCount === 0 &&
        updateResult.upsertedCount === 0 &&
        updateResult1.modifiedCount === 0 &&
        updateResult1.upsertedCount === 0 &&
        updateResult2.modifiedCount === 0 &&
        updateResult2.upsertedCount === 0
      ) {
        return res
          .status(400)
          .json({ message: "Failed to update consignment status" });
      }

      // Start live tracking
      if (newStatus === "on the way") {
        let io = getIO();
        io.emit(`startTracking:${consignmentId}`, {
          travelId,
          consignmentId,
          message: "Consignment collected, start sending live location",
        });
      }

      console.log(
        `Consignment Updated - Travel ID: ${travelId}, Consignment ID: ${consignmentId}, New Status: ${newStatus}, Pickup Location: ${
          pickupLocation ? JSON.stringify(pickupLocation) : "N/A"
        }`
      );

      // Prepare response matching UI
      const responseData = {
        message: "Consignment status updated successfully",
        travelId,
        consignmentId,
        status: newStatus,
        statusHistory: [
          {
            status: "Collected",
            time: pickupTime,
            ...(pickupLocation && { location: pickupLocation }),
          },
          {
            status: "Completion Pending",
          },
        ],
        pickup: {
          name: consignmentToCarry?.sender || "Gaurish Banga",
          phone: consignmentToCarry?.senderphone || "+91-9873738032",
          location: Consignment?.startinglocation || "Kashmiri Gate ISBT, New Delhi",
          ...(pickupLocation && { coordinates: pickupLocation }),
        },
        drop: {
          name: consignmentToCarry?.receiver || "Aryan Singh",
          phone: consignmentToCarry?.receiverphone || "+91-9873738032",
          location: Consignment?.goinglocation || "Amritsar Bus Terminal",
        },
        description:
          Consignment?.Description ||
          "Lorem ipsum dolor sit amet consectetur. Tincidunt nec maecenas.",
        weight: Consignment?.weight || "2 Kg",
        dimensions: Consignment?.dimensions || "10x10x12",
        handleWithCare: Consignment?.handleWithCare || "Yes",
        specialRequest: Consignment?.specialRequest || "No",
        dateOfSending: Consignment?.dateOfSending
          ? moment(Consignment.dateOfSending).format("DD/MM/YYYY")
          : "21/01/2024",
        expectedEarning: Consignment.earning || "₹500",
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.error("Error updating consignment status:", error.message);
      if (!res.headersSent) {
        return res
          .status(500)
          .json({ message: "Internal server error", error: error.message });
      }
    }
  };

   const deliver = async (req, res) => {
  try {
    const { travelId, consignmentId } = req.query;
    const { status, otp, ltd, lng } = req.body;

    // Validate required parameters
    if (!travelId || !consignmentId || !status) {
      return res
        .status(400)
        .json({ message: "Missing travelId, consignmentId, or status" });
    }

    // Validate MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(travelId) || !mongoose.Types.ObjectId.isValid(consignmentId)) {
      return res.status(400).json({ message: "Invalid travelId or consignmentId format" });
    }

    // Validate status type and value
    if (typeof status !== 'string') {
      return res.status(400).json({ message: "Status must be a string" });
    }

    if (status.toLowerCase() !== "completed") {
      return res.status(400).json({ message: "Invalid status for delivery. Status must be 'Completed'" });
    }

    // Validate coordinates
    const latitude = parseFloat(ltd);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ message: "Invalid coordinates format" });
    }
    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "Coordinates out of valid range" });
    }

    // Validate OTP type
    if (typeof otp !== 'string' && typeof otp !== 'number') {
      return res.status(400).json({ message: "Invalid OTP format" });
    }

    const con = await consignmenttocarry.findOne({ consignmentId });
    if (!con) {
      return res.status(404).json({ message: "Consignment not found" });
    }
    
    const cons = await consignment.findOne({ consignmentId });
    if (!cons) {
      return res.status(404).json({ message: "Consignment details not found" });
    }

    const travel = await traveldetails.findOne({ travelId });
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }

    if (travel.status !== "started") {
      return res
        .status(400)
        .json({ message: "Cannot deliver consignment before starting the travel" });
    }

    if (otp !== cons.rotp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const newStatus = "Delivered";
    const deliveredTime = new Date().toISOString();

    // Prepare delivery location with type safety
    const deliveryLocation = {
      lat: Number(latitude),
      lng: Number(longitude)
    };

    // Validate final location values
    if (isNaN(deliveryLocation.lat) || isNaN(deliveryLocation.lng)) {
      return res.status(400).json({ message: "Invalid delivery location coordinates" });
    }

    const updateResult = await Promise.all([
      consignmenthistory.updateOne(
        { consignmentId },
        {
          $set: {
            status: newStatus,
            delivered: deliveredTime,
            consignmentdelivertime: deliveredTime,
            deliveryLocation: {
              lat: Number(deliveryLocation.lat),
              lng: Number(deliveryLocation.lng)
            }
          },
        }
      ),
      consignmenttocarry.updateOne(
        { consignmentId },
        {
          $set: {
            status: newStatus,
            updatedAt: deliveredTime,
            deliveryLocation: {
              lat: Number(deliveryLocation.lat),
              lng: Number(deliveryLocation.lng)
            }
          },
        }
      ),
      travelhistory.updateOne(
        { travelId, "consignmentDetails.consignmentId": consignmentId },
        {
          $set: {
            status: "ENDED",
            "consignmentDetails.$.status": "DELIVERED",
            liveLocation: {
              lat: Number(deliveryLocation.lat),
              lng: Number(deliveryLocation.lng),
              timestamp: new Date(),
            }
          },
          $push: {
            locationHistory: {
              lat: Number(deliveryLocation.lat),
              lng: Number(deliveryLocation.lng),
              timestamp: new Date(),
            }
          },
        }
      ),
    ]);

    if (
      updateResult[0].modifiedCount === 0 ||
      updateResult[1].modifiedCount === 0 ||
      updateResult[2].modifiedCount === 0
    ) {
      return res
        .status(400)
        .json({ message: "Failed to update consignment status" });
    }

    // Stop live tracking
    let io = getIO();
    if (io) {
      io.emit(`stopTracking:${consignmentId}`, {
        travelId,
        consignmentId,
        message: "Consignment delivered, stop sending live location",
      });
    }

    console.log(
      `Consignment Updated - Travel ID: ${travelId}, Consignment ID: ${consignmentId}, New Status: ${newStatus}, Delivery Location: ${JSON.stringify(deliveryLocation)}`
    );

    return res.status(200).json({
      message: "Consignment status updated successfully",
      travelId,
      consignmentId,
      status: newStatus,
      drop: {
        location: cons?.goinglocation || "Amritsar Bus Terminal",
        coordinates: {
          lat: Number(deliveryLocation.lat),
          lng: Number(deliveryLocation.lng)
        }
      },
    });
  } catch (error) {
    console.error("Error updating consignment status:", error.message);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  }
};

    




// Controller to fetch consignment status
const setconsignmetstatus = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { consignmentId } = req.query;

    // Validate required parameters
    if (!phoneNumber || !consignmentId) {
      return res.status(400).json({ message: "Missing phoneNumber or consignmentId" });
    }

    // Validate phone number format
    if (!/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Validate consignmentId format
    if (!mongoose.Types.ObjectId.isValid(consignmentId)) {
      return res.status(400).json({ message: "Invalid consignmentId format" });
    }

    const consignmentStatus = await consignmenthistory.findOne({ consignmentId });

    if (!consignmentStatus) {
      return res.status(404).json({ message: "Consignment does not exist" });
    }

    const steps = [];

    const formatDate = (date) => {
      if (!date) return { date: "N/A", time: "N/A", day: "N/A" };
      
      // Ensure date is valid
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return { date: "N/A", time: "N/A", day: "N/A" };
      }

      return {
        date: d.toLocaleDateString(),
        time: d.toLocaleTimeString(),
        day: d.toLocaleDateString('en-US', { weekday: 'long' })
      };
    };

    // Validate status string
    const status = String(consignmentStatus.status || "").toLowerCase();
    
    const validStatuses = ["on the way", "in transit", "delivered"];
    const collectedCompleted = validStatuses.includes(status);
    
    steps.push({
      step: "Consignment Collected",
      completed: collectedCompleted,
      updatedat: collectedCompleted && consignmentStatus.collected ? 
        formatDate(consignmentStatus.collected) : 
        { date: "N/A", time: "N/A", day: "N/A" }
    });

    const deliveredCompleted = status === "delivered";
    steps.push({
      step: "Consignment Completed",
      completed: deliveredCompleted,
      updatedat: deliveredCompleted && consignmentStatus.delivered ? 
        formatDate(consignmentStatus.delivered) : 
        { date: "N/A", time: "N/A", day: "N/A" }
    });

    return res.status(200).json({ status: steps });

  } catch (error) {
    console.error("Error fetching consignment status:", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const ridestatus = async (req, res) => {
  try {
    const { travelId } = req.query;

    // Validate required parameters
    if (!travelId) {
      return res.status(400).json({ message: "Travel ID is required" });
    }

    // Validate travelId format
    if (!mongoose.Types.ObjectId.isValid(travelId)) {
      return res.status(400).json({ message: "Invalid travelId format" });
    }

    const travel = await traveldetails.findOne({ travelId });
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }

    const earn = await earning.findOne({ travelId });
    const statusList = [];

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    // Validate and process ride completion status
    const rideStatus = String(travel.status || "").toLowerCase();
    const isRideCompleted = rideStatus === "completed";
    const rideEndDate = formatDate(travel.endedat);
    
    statusList.push({
      step: "Ride Completed",
      completed: isRideCompleted,
      ...(rideEndDate && { updatedat: rideEndDate })
    });

    // Validate and process earning status
    if (earn) {
      const earningStatus = String(earn.status || "").toLowerCase();
      
      // Check earning in progress
      const isEarningInProgress = earningStatus === "inprogress";
      const earningUpdateDate = formatDate(earn.updatedAt) || 
                               formatDate(currentime.getCurrentDateTime());

      statusList.push({
        step: "Earning (Transaction) In Progress",
        completed: isEarningInProgress,
        ...(isEarningInProgress && earningUpdateDate && { updatedat: earningUpdateDate })
      });

      // Check earning completed
      const isEarningCompleted = earningStatus === "completed";
      const earningCompletionDate = formatDate(earn.updatedat) || 
                                   formatDate(currentime.getCurrentDateTime());

      statusList.push({
        step: "Earning (Transaction) Completed",
        completed: isEarningCompleted,
        ...(isEarningCompleted && earningCompletionDate && { updatedat: earningCompletionDate })
      });
    } else {
      // If no earning record exists, add default status entries
      statusList.push(
        {
          step: "Earning (Transaction) In Progress",
          completed: false
        },
        {
          step: "Earning (Transaction) Completed",
          completed: false
        }
      );
    }

    return res.status(200).json({ status: statusList });

  } catch (error) {
    console.error("Error fetching ride status:", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};





module.exports = {
    
    pickupconsignment,
    setconsignmetstatus,
    ridestatus,
    setconsignmetstatus ,
    deliver
};
