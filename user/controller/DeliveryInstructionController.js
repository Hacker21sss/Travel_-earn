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
       if (
      (status.toLowerCase() === "collected" || status.toLowerCase() === "pending") &&
      (!ltd || !lng || isNaN(ltd) || isNaN(lng))
    ) {
      return res
        .status(400)
        .json({ message: "Latitude (ltd) and longitude (lng) are required for pickup" });
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
     const pickupLocation =
      newStatus === "on the way"
        ? { lat: parseFloat(ltd), lng: parseFloat(lng) }
        : null;

    // Update ConsignmentRequestHistory
    const updateResult = await consignmenthistory.updateOne(
      { consignmentId },
      {
        $set: {
          status: newStatus,
          collected: pickupTime,
          ...(pickupLocation && { pickupLocation }),
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

    // Update consignment to carry
    const updateResult1 = await consignmenttocarry.updateOne(
      { travelId, consignmentId },
      {
        $set: {
          status: newStatus,
          consignmentpickuptime: pickupTime,
          ...(pickupLocation && { pickupLocation }),
        },
      },
      { upsert: true }
    );

    // Update travelhistory
    const updateResult2 = await travelhistory.updateOne(
      { travelId, "consignmentDetails.consignmentId": consignmentId },
      {
        $set: {
          status: "STARTED",
          "consignmentDetails.$.status": newStatus === "Collected" ? "on the way" : newStatus,
          ...(pickupLocation && {
            liveLocation: {
              lat: parseFloat(ltd),
              lng: parseFloat(lng),
              timestamp: new Date(),
            },
          }),
        },
        $push: {
          ...(pickupLocation && {
            locationHistory: {
              lat: parseFloat(ltd),
              lng: parseFloat(lng),
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

    // Validate location for "Delivered" status
    if (status.toLowerCase() === "completed" && (!ltd || !lng || isNaN(ltd) || isNaN(lng))) {
      return res
        .status(400)
        .json({ message: "Latitude (ltd) and longitude (lng) are required for delivery" });
    }

    const con = await consignmenttocarry.findOne({ consignmentId });
    if (!con) {
      return res.status(404).json({ message: "Consignment not found" });
    }
    const cons = await consignment.findOne({ consignmentId });

    const travel = await traveldetails.findOne({ travelId });
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }

    if (travel.status !== "started") {
      return res
        .status(400)
        .json({ message: "Cannot pick up consignment before starting the travel" });
    }

    if (otp !== cons.rotp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    let newStatus;
    if (status === "Completed") {
      newStatus = "Delivered";
    } else {
      return res.status(400).json({ message: "Invalid status transition" });
    }

    const deliveredTime = new Date().toISOString();

    // Prepare delivery location
    const deliveryLocation =
      newStatus === "Delivered"
        ? { lat: parseFloat(ltd), lng: parseFloat(lng) }
        : null;

    const updateResult = await Promise.all([
      consignmenthistory.updateOne(
        { consignmentId },
        {
          $set: {
            status: newStatus,
            delivered: deliveredTime,
            consignmentdelivertime: deliveredTime,
            ...(deliveryLocation && { deliveryLocation }),
          },
        }
      ),
      consignmenttocarry.updateOne(
        { consignmentId },
        {
          $set: {
            status: newStatus,
            updatedAt: deliveredTime,
            ...(deliveryLocation && { deliveryLocation }),
          },
        }
      ),
      travelhistory.updateOne(
        { travelId, "consignmentDetails.consignmentId": consignmentId },
        {
          $set: {
            status: "ENDED",
            "consignmentDetails.$.status": "DELIVERED",
            ...(deliveryLocation && {
              liveLocation: {
                lat: parseFloat(ltd),
                lng: parseFloat(lng),
                timestamp: new Date(),
              },
            }),
          },
          $push: {
            ...(deliveryLocation && {
              locationHistory: {
                lat: parseFloat(ltd),
                lng: parseFloat(lng),
                timestamp: new Date(),
              },
            }),
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
    if (newStatus === "Delivered") {
      let io = getIO();
      io.emit(`stopTracking:${consignmentId}`, {
        travelId,
        consignmentId,
        message: "Consignment delivered, stop sending live location",
      });
    }

    console.log(
      `Consignment Updated - Travel ID: ${travelId}, Consignment ID: ${consignmentId}, New Status: ${newStatus}, Delivery Location: ${
        deliveryLocation ? JSON.stringify(deliveryLocation) : "N/A"
      }`
    );

    return res.status(200).json({
      message: "Consignment status updated successfully",
      travelId,
      consignmentId,
      status: newStatus,
      drop: {
        location: cons?.goinglocation || "Amritsar Bus Terminal",
        ...(deliveryLocation && { coordinates: deliveryLocation }),
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

      if (!phoneNumber || !consignmentId) {
          return res.status(400).json({ message: "Missing phoneNumber or consignmentId" });
      }

      const consignmentStatus = await consignmenthistory.findOne({ consignmentId });

      if (!consignmentStatus) {
          return res.status(404).json({ message: "Consignment does not exist" });
      }

      const steps = [];

      
      const formatDate = (date) => {
          if (!date) return { date: "N/A", time: "N/A", day: "N/A" };
          const d = new Date(date);
          return {
              date: d.toLocaleDateString(),
              time: d.toLocaleTimeString(),
              day: d.toLocaleDateString('en-US', { weekday: 'long' })
          };
      };

     
      const collectedCompleted = consignmentStatus.status === "on the way" || 
                                consignmentStatus.status === "In Transit" || 
                                consignmentStatus.status === "Delivered";
      steps.push({
          step: "Consignment Collected",
          completed: collectedCompleted,
          ...(collectedCompleted && consignmentStatus.collected ? 
              { updatedat: formatDate(consignmentStatus.collected) } : 
              { updatedat: { date: "N/A", time: "N/A", day: "N/A" } })
      });

      
      const deliveredCompleted = consignmentStatus.status === "Delivered";
      steps.push({
          step: "Consignment Completed",
          completed: deliveredCompleted,
          ...(deliveredCompleted && consignmentStatus.collected ? 
              { updatedat: formatDate(consignmentStatus.delivered) } : 
              { updatedat: { date: "N/A", time: "N/A", day: "N/A" } })
      });

      return res.status(200).json({ status: steps });

  } catch (error) {
      console.error("Error fetching consignment status:", error.message);
      return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const ridestatus= async (req, res) => {
    try {
        const { travelId } = req.query;

        if (!travelId) {
            return res.status(400).json({ message: "Travel ID is required" });
        }

        const travel = await traveldetails.findOne({ travelId });
        if (!travel) {
            return res.status(404).json({ message: "Travel not found" });
        }

        const earn = await earning.findOne({ travelId });

        const statusList = [];

      
        if (travel.status === "Completed" && travel.endedat) {
            statusList.push({
                step: "Ride Completed",
                completed: true,
                updatedat: travel.endedat
            });
        } else {
            statusList.push({
                step: "Ride Completed",
                completed: false
            });
        }

        
        if (earn && earn.status === "inprogress") {
            statusList.push({
                step: "Earning (Transaction) In Progress",
                completed: true,
                updatedat: earn.updatedAt || currentime.getCurrentDateTime()
            });
        } else {
            statusList.push({
                step: "Earning (Transaction) In Progress",
                completed: false
            });
        }

       
        if (earn && earn.status === "Completed") {
            statusList.push({
                step: "Earning (Transaction) Completed",
                completed: true,
                updatedat: earn.updatedat || currentime.getCurrentDateTime()
            });
        } else {
            statusList.push({
                step: "Earning (Transaction) Completed",
                completed: false
            });
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
