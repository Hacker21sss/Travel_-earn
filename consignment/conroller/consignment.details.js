const { body, validationResult } = require('express-validator');
const Consignment = require('../../consignment/model/contraveldetails');
const mapservice = require('../../service/mapservice');
const userprofiles = require('../../user/model/Profile');

const Traveldetails = require('../../user/model/traveldetails');
const fare = require('../../service/price.service');
const riderequest=require('../../consignment/model/riderequest')
const { v4: uuidv4 } = require('uuid');


const {getIO, sendMessageToSocketId}=require('../../socket');

const Notification=require('../../user/model/notification');
const ConsignmentRequestHistory=require('../../consignment/model/conhistory')



const validateConsignment = [
  body('phoneNumber').isString().withMessage('User phone number must be a string'),

  body('startinglocation').isString().withMessage("Starting location is required"),
  body('goinglocation').isString().withMessage("Going location is required"),
  body('recievername').notEmpty().withMessage('Receiver name is required'),
  body('recieverphone').isMobilePhone().withMessage('Valid receiver phone number is required'),
  body('Description').notEmpty().withMessage('Description is required'),
  body('weight').isNumeric().withMessage('Weight must be a number'),
  body('category').isIn(['document', 'nondocument']).withMessage('Category must be either "document" or "nondocument"'),
  body('dimensions.length').isNumeric().withMessage('Length must be a number'),
  body('dimensions.breadth').isNumeric().withMessage('Breadth must be a number'),
  body('dimensions.height').isNumeric().withMessage('Height must be a number'),
  body('dimensions.unit').isIn(['cm', 'inch']).withMessage('Unit must be either "cm" or "inch"'),
  body('dateOfSending').isISO8601().toDate().withMessage('Valid date of sending is required'),
  body('durationAtEndPoint').notEmpty().withMessage('Duration at end point is required'),
];





module.exports = {
  validateConsignment,
  createConsignment: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        phoneNumber,
        startinglocation,
        goinglocation,
        recievername,
        
        recieverphone,
        Description,
        weight,
        category,
        dimensions, 
        dateOfSending,
        durationAtEndPoint,
       
      } = req.body;
      const currentDate = new Date();
      const sendingDate = new Date(dateOfSending);
      if (sendingDate < currentDate.setHours(0, 0, 0, 0)) {
        return res.status(400).json({ message: "please put the valid date " });
    }
      
      const user = await userprofiles.findOne({ phoneNumber });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const username = `${user.firstName} ${user.lastName}`;

      
      const startingCoordinates = await mapservice.getAddressCoordinate(startinglocation);
      const goingCoordinates = await mapservice.getAddressCoordinate(goinglocation);

      if (!startingCoordinates) {
        return res.status(400).json({ message: 'Unable to fetch coordinates for starting location' });
      }
      if (!goingCoordinates) {
        return res.status(400).json({ message: 'Unable to fetch coordinates for going location' });
      }

      
      const { distance, duration } = await mapservice.getDistanceTime(startinglocation, goinglocation);

      console.log("Distance Response:", distance.text);
      console.log("Duration Response:", duration.text);

      const distanceValue = parseFloat(distance.text.replace(/[^\d.]/g, ''));
      if (isNaN(distanceValue)) {
        return res.status(400).json({ message: 'Invalid distance received from map service' });
      }

    //  const calculateWeightFromDimensions = (length, width, height) => {
    //     if (!length || !width || !height) {
    //       console.error("Dimensions are required");
    //       return null;
    //     }
    //     if (length < 0 || width < 0 || height < 0) {
    //       console.error("Invalid dimensions provided");
    //       return null;
    //     }
    //     const dimensional1Weight = (length * width * height) / 5000;
    //     return dimensional1Weight;
    //   };

    //   // Ensure weight is a valid number
    //   // let userWeight = parseFloat(weight) || 0;

    //   // Calculate dimensional weight if dimensions are provided
    //   let dimensionalWeight = 0;
    //   if (dimensions && dimensions.breadth && dimensions.length && dimensions.height) {
    //     const calculatedWeight = calculateWeightFromDimensions(
    //       parseFloat(dimensions.length),
    //       parseFloat(dimensions.width),
    //       parseFloat(dimensions.height)
    //     );
    //     if (calculatedWeight !== null) {
    //       dimensionalWeight = parseFloat(calculatedWeight.toFixed(2));
    //     }
    //   }

    //   // Use the higher weight for fare calculation
    //   const finalWeight = Math.max(userWeight, dimensionalWeight);
    //   console.log("User Weight:", userWeight);
    //   console.log("Dimensional Weight:", dimensionalWeight);
    //   console.log("Final Weight:", finalWeight);

    
    // // Ensure weight is always a valid number
    // let finalWeight = parseFloat(weight) || 0; // Convert `weight` to a number
    
    // // Check if dimensions exist before calculating weight
    // if (dimensions && dimensions.length && dimensions.width && dimensions.height) {
    //     const calculatedWeight = calculateWeightFromDimensions(
    //         parseFloat(dimensions.length), 
    //         parseFloat(dimensions.width), 
    //         parseFloat(dimensions.height)
    //     );
    
    //     if (calculatedWeight !== null) {
    //         finalWeight = parseFloat(calculatedWeight.toFixed(2)); // Ensure it's a valid number
    //     }
    // }
    
    // console.log("Final Weight:", finalWeight);
    
    
    // if (isNaN(finalWeight)) {
    //     finalWeight = 0;  
    // }
    
    
    // const trainFare = fare.calculateFare(finalWeight, distanceValue, "Train");
    // const airplaneFare = fare.calculateFare(finalWeight, distanceValue, "Aeroplane");
    
    // console.log("Train Fare:", trainFare);
    // console.log("Airplane Fare:", airplaneFare);
    
    

      
      const consignmentId = uuidv4();
      let image = null;
            if (req.file) {
                image = `/uploads/${req.file.filename}`; // Relative path for accessing image
            }
     

      
      const newConsignment = new Consignment({
        phoneNumber,
        username,
        startinglocation,
        goinglocation,
        LeavingCoordinates: {
          longitude: startingCoordinates.lng,
          latitude: startingCoordinates.ltd, 
        },
        GoingCoordinates: {
          longitude: goingCoordinates.lng,
          latitude: goingCoordinates.ltd, 
        },
        recievername,
        recieverphone,
        Description,
        weight, 
        category,
        dimensions,
        dateOfSending,
        durationAtEndPoint,
        consignmentId,
        distance: distance.text,
        duration: duration.text,
        images:image
        // sotp,
        // rotp

        // trainfare: trainFare,
        // aeroplanefare: airplaneFare,
      });
      const consignmenthistory=new ConsignmentRequestHistory({
        ownerPhoneNumber:phoneNumber,
        senderName:username,
  

        senderAddress: startinglocation,
        receiverAddress: goinglocation,
      
        receiverName: recievername,
        receiverPhoneNumber:recieverphone,
        description: Description,
        weight:weight, 
        category:category,
        dimensions:JSON.stringify(dimensions),
        
        consignmentId: consignmentId,
        distance: distance.text,
       

      });
      await consignmenthistory.save();
      console.log(consignmenthistory);


      const savedConsignment = await newConsignment.save();
      res.status(201).json({
        message: 'Consignment created successfully',
        consignment: savedConsignment
      });

    } catch (error) {
      console.error("Error creating consignment:", error);
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  },
};

module.exports.getConsignmentsByDate = async (req, res) => {
  try {
    const { leavingLocation, goingLocation, date} = req.query;

console.log('date comes',req.query.date)


    if (!leavingLocation || !goingLocation || !date ) {
      return res.status(400).json({ message: "Leaving location, going location, and date are required" });
    }

    const searchDate = new Date(date);
    const today = new Date();
 
    console.log('searchdate',searchDate)


    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }
    if (searchDate < today.setHours(0, 0, 0, 0)) {
      return res.status(404).json({ message: "No consignments available the dates." });
  }
    
        


    // Fetch coordinates from mapservice
    const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
    const goingCoords = await mapservice.getAddressCoordinate(goingLocation);

    if (!leavingCoords || !goingCoords) {
      return res.status(400).json({ message: "Invalid location input. Please enter a valid city or address." });
    }

    console.log("Leaving Coordinates:", leavingCoords);
    console.log("Going Coordinates:", goingCoords);

    // Query the database
    const availableRides = await Consignment.find({
      "LeavingCoordinates.latitude": leavingCoords.ltd, 
      "LeavingCoordinates.longitude": leavingCoords.lng,
      "GoingCoordinates.latitude": goingCoords.ltd,    
      "GoingCoordinates.longitude": goingCoords.lng,
      dateOfSending: {
        $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
        $lt: new Date(searchDate.setHours(23, 59, 59, 999))
      }
    });

    if (!availableRides.length) {
      return res.status(404).json({ message: "No consignments found for the given date and locations." });
    }

    // Return full consignment data without creating separate arrays
    res.status(200).json({
      message: "Consignments found",
      consignments: availableRides
    });

  } catch (error) {
    console.error("Error in getConsignmentsByDate:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};





module.exports.getconsignment = async (req, res) => {
  try {
    const { phoneNumber, consignmentId } = req.body;

    // Find user by phone number
    const user = await userprofiles.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    const con = await Consignment.findOne({ consignmentId });
    if (!con) {
      return res.status(404).json({ message: "Consignment not found" });
    }
    const Ride = await Traveldetails.findOne({ phoneNumber }).sort({  updatedAt: -1 });

    if (!Ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const validModes = ["train", "airplane","car"];
    const travelMode = Ride.travelMode ? Ride.travelMode.toLowerCase().trim() : null;

    if (!validModes.includes(travelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train' or 'airplane'." });
    }

    const weight = parseFloat(con.weight?.toString().replace(/[^\d.]/g, ""));
    const distance = parseFloat(con.distance?.toString().replace(/[^\d.]/g, ""));

    if (isNaN(weight) || isNaN(distance)) {
      return res.status(400).json({ message: "Invalid Weight or Distance! Please provide valid numbers." });
    }

    // Ensure fare.calculateFare function exists
    if (typeof fare.calculateFare !== "function") {
      return res.status(500).json({ message: "Fare calculation function is missing or not defined." });
    }

    const expectedEarning = fare.calculateFare(weight, distance, travelMode);

    
    console.log("E:",expectedEarning);

    
    
    // Convert weight and distance to float
   
    // Booking response
    const booking = {
      phoneNumber,
      consignmentId,
      consignmentDetails: con,
      expectedEarning

      
    };

    return res.status(200).json({ message: "Request sent to user", booking });
  } catch (error) {
    console.error("Error in booking:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports.getallconsignment = async (req, res) => {
  const { phoneNumber } = req.params; // If phoneNumber is sent in the request body

  try {
    // Check if phoneNumber is provided in the request body
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Find the user by phoneNumber
    const user = await userprofiles.findOne({ phoneNumber });

    // If user is not found, return error response
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch consignments for the user using the user's phoneNumber
    const consignments = await Consignment.find({ phoneNumber: user.phoneNumber });
    
    

    // If no consignments are found, return a message indicating no consignments exist
    if (!consignments || consignments.length === 0) {
      return res.status(404).json({ message: "No consignments found for this phone number" });
    }

    // Return consignments successfully
    return res.status(200).json({
      message: 'Consignment history found',
      consignments,
      
    });

  } catch (error) {
    console.error('Error in getting all consignments:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// module.exports.getearning = async (req, res) => {
//   try {
//     const { phoneNumber, consignmentId } = req.body;

//     // Find user by phone number
//     const user = await userprofiles.findOne({ phoneNumber });
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

    
//     const con = await Consignment.findOne({ consignmentId });
//     if (!con) {
//       return res.status(404).json({ message: "Consignment not found" });
//     }

    
//     const Ride = await Traveldetails.findOne({ phoneNumber }).sort({ updatedAt: -1 }) 
//     .limit(1);

//     if (!Ride) {
//       return res.status(404).json({ message: "Ride not found" });
//     }
//     console.log(Ride.distance);
//     console.log(Ride.travelMode);

    
//     const validModes = ["train", "airplane"];
//     const travelMode = Ride.travelMode ? Ride.travelMode.toLowerCase().trim() : null;

//     if (!validModes.includes(travelMode)) {
//       return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train' or 'aeroplane'." });
//     }

//     // Convert weight and distance to float
//     const weight = parseFloat(con.weight.toString().replace(/[^\d.]/g, "")); 
//     const distance = parseFloat(con.distance.toString().replace(/[^\d.]/g, ""));

//     if (isNaN(weight) || isNaN(distance)) {
//       return res.status(400).json({ message: "Invalid Weight or Distance! Please provide valid numbers." });
//     }

//     // Debugging logs (check values before fare calculation)
//     console.log("Travel Mode:", travelMode);
//     console.log("Weight:", weight);
//     console.log("Distance:", distance);

//     // Calculate expected earnings
//     const expectedearning = fare.calculateFare( weight,distance,travelMode);

//     // Booking response
//     const booking = {
//       phoneNumber,
//       consignmentId,
      
//       expectedearning,
//     };

//     return res.status(200).json({ message: "successful", booking });
//   } catch (error) {
//     console.error("Error :", error.message);
//     return res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };



module.exports.getearning = async (req, res) => {
  try {
    const { phoneNumber, consignmentId } = req.body;

    if (!phoneNumber || !consignmentId) {
      return res.status(400).json({ message: "Phone number and consignment ID are required." });
    }

   
    const user = await userprofiles.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    const con = await Consignment.findOne({ consignmentId });
    if (!con) {
      return res.status(404).json({ message: "Consignment not found" });
    }

  
    const Ride = await Traveldetails.findOne({ phoneNumber }).sort({ updatedAt: -1 });

    if (!Ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const validModes = ["train", "airplane", "car"];
    const travelMode = Ride.travelMode ? Ride.travelMode.toLowerCase().trim() : null;

    if (!validModes.includes(travelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train', 'airplane', or 'car'." });
    }


    const dimensionalWeightRaw = fare.dimension(con.dimensions.breadth, con.dimensions.length, con.dimensions.height);
    console.log("Dimensional Weight Raw:", dimensionalWeightRaw);

    
    const dimensionalWeight = parseFloat(dimensionalWeightRaw?.toString().replace(/[^\d.]/g, ""));
    const userWeight = parseFloat(con.weight?.toString().replace(/[^\d.]/g, ""));
    const distance = parseFloat(con.distance?.toString().replace(/[^\d.]/g, ""));

    if (isNaN(dimensionalWeight) || isNaN(userWeight) || isNaN(distance)) {
      return res.status(400).json({ message: "Invalid Weight, Dimensional Weight, or Distance! Please provide valid numbers." });
    }

    
    const Weight = Math.max(dimensionalWeight, userWeight);
    console.log("User Weight:", userWeight);
    console.log("Dimensional Weight:", dimensionalWeight);
    console.log("Final Weight for Fare:", Weight);

    
    if (typeof fare.calculateFare !== "function") {
      return res.status(500).json({ message: "Fare calculation function is missing or not defined." });
    }

    const expectedEarning = fare.calculateFare(Weight, distance, travelMode);
    const senderPhoneNumber = Ride.phoneNumber;

    if (!senderPhoneNumber) {
      return res.status(400).json({ message: "Consignment owner phone number not found." });
    }

    const requestto = con.phoneNumber;
    console.log("Creating notification with requestto:", requestto);
    const notification = new Notification({
      phoneNumber: senderPhoneNumber,
      ridername: Ride.username,
      requestedby: senderPhoneNumber,
      requestto,
      travelId: Ride.travelId,
      earning: expectedEarning,
      consignmentId: con.consignmentId,
      notificationType: "ride_request"
    });

    await notification.save();
    console.log("Notification sent to consignment owner:", requestto);
    console.log("Notification saved:", notification);
const userprofile=await userprofiles.findOne({phoneNumber:Ride.phoneNumber});
    const rideRequestHistory = new riderequest({
      phoneNumber: con.phoneNumber,
      requestedby: Ride.phoneNumber,
      consignmentId: consignmentId,
      requestto: con.phoneNumber,
      pickup: Ride.Leavinglocation,
      drop: Ride.Goinglocation,
      expectedendtime: Ride.expectedEndTime,
      rider: Ride.username,
      travelMode: Ride.travelMode,
      earning: expectedEarning,
      rideId: Ride.rideId,
      travelId: Ride.travelId,
      rating: user.averageRating,
      totalrating: user.totalrating,
      profilepicture: userprofile.profilePicture
    });

    await rideRequestHistory.save();
    console.log("Consignment request history saved:", rideRequestHistory);

    const io = getIO();
    const consignmentProfile = await userprofiles.findOne({ phoneNumber: senderPhoneNumber });

    if (consignmentProfile && consignmentProfile.socketId) {
      const socketId = consignmentProfile.socketId;

      sendMessageToSocketId(socketId, {
        event: "newBookingRequest",
        data: {
          message: `New booking request from ${phoneNumber}.`,
          phoneNumber,
          RideId: Ride.rideId,
          expectedEarning,
        },
      });

      console.log(`📢 Real-time notification sent to ${senderPhoneNumber} (socket: ${socketId})`);
    } else {
      console.log(`⚠️ Rider ${senderPhoneNumber} is not connected to Socket.io.`);
    }

    return res.status(200).json({
      message: "Success",
    });

  } catch (error) {
    console.error("Error:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports.getRideRequests = async (req, res) => {
  try {
    let { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number parameter is required." });
    }

    console.log("Fetching ride requests for:", phoneNumber);

  
    phoneNumber = phoneNumber.trim();

    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const alternativeNumber = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : phoneNumber; 

  
    const rideRequests = await riderequest.find({
      $or: [
        { phoneNumber: formattedNumber },
        { phoneNumber: alternativeNumber },
        { requestedby: formattedNumber },
        { requestedby: alternativeNumber }
      ]
    }).sort({ createdAt: -1 }).limit(1);

    console.log("Ride requests found:", rideRequests);

    if (!rideRequests || rideRequests.length === 0) {
      return res.status(404).json({ message: "No ride requests found for this user." });
    }

    return res.status(200).json({
      message: "Ride requests retrieved successfully",
      rideRequests
    });

  } catch (error) {
    console.error("Error fetching ride requests:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};






