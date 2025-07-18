const { body, validationResult } = require('express-validator');
const Consignment = require('../../consignment/model/contraveldetails');
const mapservice = require('../../service/mapservice');
const userprofiles = require('../../user/model/Profile');
const imagekit = require('../../user/controller/imagekit');

const Traveldetails = require('../../user/model/traveldetails');
const fare = require('../../service/price.service');
const riderequest = require('../../consignment/model/riderequest')
const { v4: uuidv4 } = require('uuid');


const { getIO, sendMessageToSocketId } = require('../../socket');

const Notification = require('../../user/model/notification');
const ConsignmentRequestHistory = require('../../consignment/model/conhistory');



const geolib = require("geolib");

/**
 * Returns bounding box for a center point and radius in meters
 */
function getBoundingBox(center, radiusInMeters) {
  const bounds = geolib.getBoundsOfDistance(center, radiusInMeters);
  return {
    minLat: bounds[0].latitude,
    maxLat: bounds[1].latitude,
    minLng: bounds[0].longitude,
    maxLng: bounds[1].longitude,
  };
}

const validateConsignment = [
  body('phoneNumber').isString().withMessage('User phone number must be a string'),

  body('startinglocation').isString().withMessage("Starting location is required"),
  body('goinglocation').isString().withMessage("Going location is required"),
  body('fullstartinglocation').isString().withMessage("Full going location is required"),
  body('fullgoinglocation').isString().withMessage("Full going location is required"),
  body('recievername').notEmpty().withMessage('Receiver name is required'),
  body('recieverphone').isMobilePhone().withMessage('Valid receiver phone number is required'),
  body('Description').notEmpty().withMessage('Description is required'),
  body('weight').isNumeric().withMessage('Weight must be a number'),
  body('category').isIn(['document', 'nondocument']).withMessage('Category must be either "document" or "nondocument"'),
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
        fullstartinglocation, 
        fullgoinglocation,
        recievername,
        travelMode,
        recieverphone,
        Description,
        weight,
        category,
        dimensions,
        dateOfSending,
        durationAtEndPoint,
        handleWithCare,
        specialRequest
      } = req.body;
      
      console.log(req.body)
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

      const parsedDimensions = JSON.parse(dimensions);
      console.log("Dimensions", parsedDimensions)
      console.log("Dimensions:", parsedDimensions.length, parsedDimensions.height, parsedDimensions.breadth)
      // const earning = await fare.calculateFare(weight, distanceValue, travelMode, parsedDimensions?.length, parsedDimensions?.height, parsedDimensions?.breadth)

      // if (!earning) {
      //   return res.status(400).json({ message: 'Unable to fetch fare' });
      // }
      
      const consignmentId = uuidv4();
      let imageUrls = [];

      // Handle multiple image uploads
      if (req.files && req.files.length > 0) {
        try {
          for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            
            // Upload the image to ImageKit
            const uploadResponse = await imagekit.upload({
              file: file.buffer,
              fileName: `${consignmentId}_parcel_image_${i}`,
              useUniqueFileName: true,
            });

            imageUrls.push(uploadResponse.url);
          }
        } catch (uploadError) {
          console.error("File upload error:", uploadError);
          return res.status(400).json({
            message: "Error uploading images",
            error: uploadError.message,
          });
        }
      }

      // Parse dimensions if it's a JSON string
      // let parsedDimensions = dimensions;
      // if (typeof dimensions === 'string') {
      //   try {
      //     parsedDimensions = JSON.parse(dimensions);
      //   } catch (error) {
      //     console.error("Error parsing dimensions:", error);
      //     return res.status(400).json({ message: 'Invalid dimensions format' });
      //   }
      // }

      const newConsignment = new Consignment({
        phoneNumber,
        username,
        startinglocation,
        goinglocation,
        fullstartinglocation,
        fullgoinglocation,
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
        dimensions: parsedDimensions,
        dateOfSending,
        durationAtEndPoint,
        consignmentId,
        distance: distance.text,
        duration: duration.text,
        images: imageUrls,
        // earning: earning,
        handleWithCare: handleWithCare === 'true' || handleWithCare === true,
        specialRequest: specialRequest || null,
      });
      
      const consignmenthistory = new ConsignmentRequestHistory({
        ownerPhoneNumber: phoneNumber,
        senderName: username,
        senderAddress: startinglocation,
        receiverAddress: goinglocation,
        senderFullAddress: fullstartinglocation,
        receiverFullAddress: fullgoinglocation,
        receiverName: recievername,
        receiverPhoneNumber: recieverphone,
        description: Description,
        weight: weight,
        category: category,
        dimensions: JSON.stringify(parsedDimensions),
        consignmentId: consignmentId,
        distance: distance.text,
        images: imageUrls,
      });
      
      await consignmenthistory.save();
      console.log(consignmenthistory);
      console.log(newConsignment)

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

// module.exports.getConsignmentsByDate = async (req, res) => {
// try {
//     const { leavingLocation, goingLocation, date, phoneNumber } = req.query;
//     console.log("Received search query:", { leavingLocation, goingLocation, date, phoneNumber });

//     // Input validation
//     if (!leavingLocation || !goingLocation || !date || !phoneNumber) {
//       return res.status(400).json({ message: "Leaving location, going location, date, and phone number are required." });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(date)) {
//       return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
//     }

//     const searchDate = new Date(date);
//     const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
//     const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
//     console.log("Date range for search:", { startOfDay, endOfDay });

//     const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
//     const goingCoords = await mapservice.getAddressCoordinate(goingLocation);

//     if (!leavingCoords || !goingCoords) {
//       return res.status(400).json({ message: "Invalid leaving or going location." });
//     }

//     // Normalize phone number
//     let cleaned = String(phoneNumber).replace(/\D/g, "").trim();
//     if (cleaned.length === 10) {
//       cleaned = `+91${cleaned}`;
//     } else {
//       cleaned = `+${cleaned}`;
//     }
//     const normalizedPhoneNumber = cleaned;

//     // Increase search radius
//     const radiusInMeters = 10 * 1000; // 10km

//     const leavingBoundingBox = getBoundingBox(
//       { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
//       radiusInMeters
//     );

//     const goingBoundingBox = getBoundingBox(
//       { latitude: goingCoords.ltd, longitude: goingCoords.lng },
//       radiusInMeters
//     );

//     const baseQuery = {
//       "LeavingCoordinates.ltd": { $gte: leavingBoundingBox.minLat, $lte: leavingBoundingBox.maxLat },
//       "LeavingCoordinates.lng": { $gte: leavingBoundingBox.minLng, $lte: leavingBoundingBox.maxLng },
//       "GoingCoordinates.ltd": { $gte: goingBoundingBox.minLat, $lte: goingBoundingBox.maxLat },
//       "GoingCoordinates.lng": { $gte: goingBoundingBox.minLng, $lte: goingBoundingBox.maxLng },
//       dateOfSending: { $gte: startOfDay, $lt: endOfDay }
//       // Uncomment if you want to exclude consignments created by the same user
//       // phoneNumber: { $ne: normalizedPhoneNumber }
//     };

//     console.log("Search query:", JSON.stringify(baseQuery, null, 2));

//     const availableConsignments = await Consignment.find(baseQuery).lean();
//     console.log("Found consignments before filtering:", availableConsignments.length);

//     // Optional: Fine-tune with geolib distance checks
//     const filteredConsignments = availableConsignments.filter(consignment => {
//       const leavingDistance = geolib.getDistance(
//         { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
//         { latitude: consignment.LeavingCoordinates?.ltd, longitude: consignment.LeavingCoordinates?.lng }
//       );
//       const goingDistance = geolib.getDistance(
//         { latitude: goingCoords.ltd, longitude: goingCoords.lng },
//         { latitude: consignment.GoingCoordinates?.ltd, longitude: consignment.GoingCoordinates?.lng }
//       );
//       return leavingDistance <= radiusInMeters && goingDistance <= radiusInMeters;
//     });

//     console.log("Filtered consignments:", filteredConsignments.length);

//     if (!filteredConsignments.length) {
//       return res.status(200).json({
//         message: "No consignments found for the given date and locations.",
//         searchParams: {
//           leavingLocation,
//           goingLocation,
//           date,
//           normalizedPhoneNumber
//         }
//       });
//     }

//     res.status(200).json({
//       message: "Consignments found",
//       consignments: filteredConsignments,
//       searchParams: {
//         leavingLocation,
//         goingLocation,
//         date,
//         normalizedPhoneNumber,
//         leavingCoords,
//         goingCoords
//       }
//     });

//   } catch (error) {
//     console.error("Error in getConsignmentsByDate:", error.stack || error.message);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };


module.exports.getConsignmentsByDate = async (req, res) => {
  try {
    const { leavingLocation, goingLocation, date, phoneNumber } = req.query;

    console.log('date comes', req.query.date)
    console.log('phoneNumber received', phoneNumber); // Debug log to verify phoneNumber

    if (!leavingLocation || !goingLocation || !date || !phoneNumber) {
      return res.status(400).json({ message: "Leaving location, going location, and date are required" });
    }

     // Normalize phoneNumber: Ensure it matches the stored format (+918927473643)
     let cleaned = String(phoneNumber).replace(/\D/g, "").trim();
     if (cleaned.length === 10) {
       cleaned = `+91${cleaned}`;
     } else {
       cleaned = `+${cleaned}`;
     }
     const normalizedPhoneNumber = cleaned

    // First, find the user by phone number
    const user = await userprofiles.findOne({ phoneNumber: normalizedPhoneNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const searchDate = new Date(date);
    const today = new Date();

    console.log('searchdate', searchDate)

    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }
    if (searchDate < today.setHours(0, 0, 0, 0)) {
      return res.status(404).json({ message: "No consignments available the dates." });
    }

    // Search for user's travel on the specified date
    const userTravel = await Traveldetails.findOne({
      phoneNumber: normalizedPhoneNumber,
      travelDate: {
        $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
        $lt: new Date(searchDate.setHours(23, 59, 59, 999))
      }
    }).sort({ updatedAt: -1 });

    if (!userTravel) {
      return res.status(404).json({ message: "No travel found for the specified date. Please publish your travel first." });
    }

    // Validate travel mode
    const validModes = ["train", "airplane", "car"];
    const travelMode = userTravel.travelMode ? userTravel.travelMode.toLowerCase().trim() : null;

    if (!validModes.includes(travelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train', 'airplane', or 'car'." });
    }

    // Fetch coordinates from mapservice
    const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
    const goingCoords = await mapservice.getAddressCoordinate(goingLocation);

    if (!leavingCoords || !goingCoords) {
      return res.status(400).json({ message: "Invalid location input. Please enter a valid city or address." });
    }

    console.log("Leaving Coordinates:", leavingCoords);
    console.log("Going Coordinates:", goingCoords);

   

    const radiusInMeters = 10 * 1000; // 10km

    const leavingBoundingBox = getBoundingBox(
      { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
      radiusInMeters
    );

    const goingBoundingBox = getBoundingBox(
      { latitude: goingCoords.ltd, longitude: goingCoords.lng },
      radiusInMeters
    );

    // Query the database
    const availableRides = await Consignment.find({
      "LeavingCoordinates.latitude": { $gte: leavingBoundingBox.minLat, $lte: leavingBoundingBox.maxLat },
      "LeavingCoordinates.longitude": { $gte: leavingBoundingBox.minLng, $lte: leavingBoundingBox.maxLng },
      "GoingCoordinates.latitude": { $gte: goingBoundingBox.minLat, $lte: goingBoundingBox.maxLat },
      "GoingCoordinates.longitude": { $gte: goingBoundingBox.minLng, $lte: goingBoundingBox.maxLng },
      dateOfSending: {
        $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
        $lt: new Date(searchDate.setHours(23, 59, 59, 999))
      },
      phoneNumber: { $ne: normalizedPhoneNumber }
    });
    console.log("availableRides", availableRides)
    if (!availableRides.length) {
      return res.status(404).json({ message: "No consignments found for the given date and locations." });
    }

    // Calculate actual price for each consignment using .map
    const consignmentsWithPrice = await Promise.all(availableRides.map(async (consignment) => {
      try {
        // Extract weight and distance from consignment
        const weight = parseFloat(consignment.weight?.toString().replace(/[^\d.]/g, ""));
        const distance = parseFloat(consignment.distance?.toString().replace(/[^\d.]/g, ""));

        if (isNaN(weight) || isNaN(distance)) {
          console.log(`Invalid weight or distance for consignment ${consignment.consignmentId}`);
          return {
            ...consignment.toObject(),
            calculatedPrice: null,
            priceError: "Invalid weight or distance"
          };
        }

        // Extract dimensions if available
        const dimensions = consignment.dimensions;
        const length = dimensions?.length;
        const height = dimensions?.height;
        const breadth = dimensions?.breadth;

        // Calculate fare using the fare service
        const {senderTotalPay, totalFare} = await fare.calculateFare(
          weight, 
          distance, 
          travelMode, 
          length, 
          height, 
          breadth
        ) ?? {};

        if(isNaN(senderTotalPay) || isNaN(totalFare)){
          return res.json({message: "error in fare calculation"})
        }

        return {
          ...consignment.toObject(),
          calculatedPrice: {senderTotalPay, totalFare},
          userTravelMode: travelMode,
          userTravelId: userTravel.travelId
        };

      } catch (error) {
        console.error(`Error calculating price for consignment ${consignment.consignmentId}:`, error);
        return {
          ...consignment.toObject(),
          calculatedPrice: null,
          priceError: error.message
        };
      }
    }));

    // Return consignments with calculated prices
    res.status(200).json({
      message: "Consignments found with calculated prices",
      consignments: consignmentsWithPrice,
      userTravelDetails: {
        travelMode: travelMode,
        travelId: userTravel.travelId,
        travelDate: userTravel.travelDate
      }
    });

  } catch (error) {
    console.error("Error in getConsignmentsByDate:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



module.exports.getconsignment = async (req, res) => {
  try {
    const { phoneNumber, consignmentId } = req.body;
    console.log(req.body)
    // Find user by phone number
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
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train' or 'airplane'." });
    }
    console.log(con.distance, con.weight)
    const weight = parseFloat(con.weight?.toString().replace(/[^\d.]/g, ""));
    const distance = parseFloat(con.distance?.toString().replace(/[^\d.]/g, ""));
    console.log(weight, distance)
    if (isNaN(weight) || isNaN(distance)) {
      return res.status(400).json({ message: "Invalid Weight or Distance! Please provide valid numbers." });
    }

    // Ensure fare.calculateFare function exists
    if (typeof fare.calculateFare !== "function") {
      return res.status(500).json({ message: "Fare calculation function is missing or not defined." });
    }

    const expectedEarning = await fare.calculateFare(weight, distance, travelMode);


    console.log("E:", expectedEarning);

    const notification = new Notification({
      phoneNumber: phoneNumber,
      requestto: con.phoneNumber,
      requestedby: phoneNumber,
      consignmentId: con.consignmentId,
      earning: expectedEarning,
      travelId: Ride.travelId,
      notificationType: "ride_request"
    });
    console.log(notification)
    await notification.save();

    // Convert weight and distance to float

    // Booking response
    const booking = {
      phoneNumber,
      consignmentId,
      consignmentDetails: con,
      expectedEarning
    };

    return res.status(200).json({ message: "Request sent to user", booking });
    // return res.status(200).json({ message: "Request sent to user"});
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


    const consignmentDate = new Date(con.createdAt).toDateString();
    const rideDate = new Date(Ride.createdAt).toDateString();
    if (consignmentDate !== rideDate) {
      return res.status(400).json({ message: "user need to publish travel on date." });
    }
    console.log("Ride : ", Ride)
    console.log("con : ", con)

    if (
      !Ride.LeavingCoordinates?.ltd || !Ride.LeavingCoordinates?.lng ||
      !con.LeavingCoordinates?.latitude || !con.LeavingCoordinates?.longitude
    ) {
      return res.status(400).json({ message: "Missing coordinates for location comparison." });
    }

    const riderStartPoint = {
      latitude: Ride.LeavingCoordinates.ltd,
      longitude: Ride.LeavingCoordinates.lng,
    };

    const boundingBox = getBoundingBox(riderStartPoint, 10000); // 10 km

    const pickup = con.LeavingCoordinates;

    const isWithinBox =
      pickup.latitude >= boundingBox.minLat &&
      pickup.latitude <= boundingBox.maxLat &&
      pickup.longitude >= boundingBox.minLng &&
      pickup.longitude <= boundingBox.maxLng;

    if (!isWithinBox) {
      return res.status(400).json({
        message: "Consignment pickup location is outside the 10 km radius of your starting location.",
      });
    }


    // Check if consignment destination matches ride destination
    // if (con.goinglocation !== Ride.Goinglocation) {
    //   return res.status(400).json({ message: "Consignment destination does not match ride destination." });
    // }

    // Check if consignment is already accepted by another traveler
    const existingRequest = await riderequest.findOne({
      consignmentId,
      status: "Accepted",
    });
    if (existingRequest) {
      return res.status(400).json({ message: "Consignment has already been accepted by another traveler." });
    }

    const validModes = ["train", "airplane", "car"];
    const travelMode = Ride.travelMode ? Ride.travelMode.toLowerCase().trim() : "car";

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

    const expectedEarning = await fare.calculateFare(Weight, distance, travelMode);
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
      notificationType: "ride_request",
    });

    await notification.save();
    console.log("Notification sent to consignment owner:", requestto);
    console.log("Notification saved:", notification);

    const userprofile = await userprofiles.findOne({ phoneNumber: Ride.phoneNumber });
    const rideRequestHistory = new riderequest({
      phoneNumber: con.phoneNumber,
      requestedby: Ride.phoneNumber,
      consignmentId: consignmentId,
      requestto: con.phoneNumber,
      pickup: Ride.Leavinglocation,
      drop: Ride.Goinglocation,
      expectedstarttime: Ride.expectedStartTime,
      expectedendtime: Ride.expectedEndTime,
      rider: Ride.username,
      travelMode: Ride.travelMode,
      earning: expectedEarning,
      rideId: Ride.rideId,
      travelId: Ride.travelId,
      rating: user.averageRating,
      totalrating: user.totalrating,
      profilepicture: userprofile.profilePicture,
      status: "pending", // Explicitly set status to pending
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
          message: ` New booking request from ${phoneNumber}`,
          phoneNumber,
          RideId: Ride.rideId,
          expectedEarning,
        },
      });

      console.log(`📢 Real-time notification sent to ${senderPhoneNumber} (socket: ${socketId})`);
    } else {
      console.log(`⚠ Rider ${senderPhoneNumber} is not connected to Socket.io.`);
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
    }).sort({ createdAt: -1 }).limit(1).lean();

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

module.exports.declinePaymentRequest = async (req, res) => {
  const { phoneNumber } = req.params;
  const { travelId, consignmentId, response } = req.body;

  console.log(req.body)
  if (!phoneNumber || !travelId || !consignmentId || !response) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {

    const notificationData = await Notification.findOne({ travelId, consignmentId });

    if (!notificationData) {
      return res.status(404).json({ message: 'Notification not found' });
    }


    if (response.toLowerCase() !== 'decline') {
      return res.status(400).json({ message: 'Invalid response value. Expected "decline"' });
    }


    await Notification.updateMany(
      { travelId, consignmentId },
      { $set: { paymentstatus: 'declined' } }
    );


    const updateResult = {
      travelId,
      consignmentId,
      status: 'declined',
      message: 'Request declined successfully',
    };

    console.log('Decline result:', updateResult);


    return res.status(200).json(updateResult);
  } catch (error) {
    console.error('Error declining payment request:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports. getConsignmentById = async (req, res) => {
  try {
    const { consignmentId } = req.params;

    if (!consignmentId) {
      return res.status(400).json({ message: "Consignment ID is required" });
    }

    console.log("Fetching consignment with ID:", consignmentId);

    const consignment = await Consignment.findOne({ consignmentId }).lean();

    if (!consignment) {
      return res.status(404).json({ message: "Consignment not found" });
    }
    console.log(consignment)
    return res.status(200).json({
      message: "Consignment retrieved successfully",
      consignment
    });

  } catch (error) {
    console.error("Error fetching consignment by ID:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};







