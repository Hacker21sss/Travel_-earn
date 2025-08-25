const { body, validationResult } = require('express-validator');
const Consignment = require('../../consignment/model/contraveldetails');
const mapservice = require('../../service/mapservice');
const userprofiles = require('../../user/model/Profile');
const imagekit = require('../../user/controller/imagekit');
const moment = require('moment-timezone');

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
  // body('durationAtEndPoint').notEmpty().withMessage('Duration at end point is required'),
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
        subCategory,
        dimensions,
        dateOfSending,
        // durationAtEndPoint,
        handleWithCare,
        specialRequest,
        userTimezone,
        timezoneOffset
      } = req.body;
      
      console.log(req.body)
      
      // Handle timezone-aware date parsing using TimezoneService
      let sendingDate;
      try {
        const TimezoneService = require('../../service/timezoneService');
        
        // Set default timezone if not provided
        const timezone = userTimezone || 'Asia/Kolkata';
        
        // Handle both Date objects and string formats
        let dateString;
        if (dateOfSending instanceof Date) {
          dateString = dateOfSending.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
        } else {
          dateString = dateOfSending;
        }
        
        // Validate and normalize the date
        const normalizedDate = TimezoneService.validateAndNormalizeDate(dateString, timezone);
        sendingDate = normalizedDate.dateObj;
        
        console.log('Timezone-aware date parsing:', {
          originalDate: dateOfSending,
          userTimezone: timezone,
          normalizedDate: normalizedDate.date,
          parsedDate: sendingDate,
          parsedDateISO: sendingDate.toISOString()
        });
        
      } catch (error) {
        console.error("Date parsing error:", error);
        return res.status(400).json({ message: "Invalid date format. Please provide a valid date." });
      }
      
      // Check if date is in the past using timezone-aware comparison
      const timezone = userTimezone || 'Asia/Kolkata';
      const currentDate = moment().tz(timezone).startOf('day');
      const sendingDateMoment = moment.tz(sendingDate, timezone);
      
      if (sendingDateMoment.isBefore(currentDate)) {
        return res.status(400).json({ message: "Please provide a valid future date." });
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
      // return res.status(500);
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
        subCategory,
        dimensions: parsedDimensions,
        dateOfSending,
        // durationAtEndPoint,
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
    const { leavingLocation, goingLocation, date, phoneNumber, userTimezone, timezoneOffset } = req.query;

    console.log('date comes', req.query.date)
    console.log('phoneNumber received', phoneNumber); // Debug log to verify phoneNumber
    console.log('timezone info:', { userTimezone, timezoneOffset });

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

    // Handle timezone-aware date parsing for search using TimezoneService
    let searchDate;
    let timezone;
    let searchMoment;
    
    try {
      const TimezoneService = require('../../service/timezoneService');
      
      // Set default timezone if not provided
      timezone = userTimezone || 'Asia/Kolkata';
      
      // Create moment object in user's timezone
      searchMoment = moment.tz(date, timezone);
      searchDate = searchMoment.toDate();
      
      if (!searchMoment.isValid()) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      
      console.log('Timezone-aware search date parsing:', {
        originalDate: date,
        userTimezone: timezone,
        parsedDate: searchMoment.format(),
        parsedDateISO: searchMoment.utc().toISOString()
      });
      
    } catch (error) {
      console.error("Date parsing error:", error);
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    console.log('searchdate', searchDate)

    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }
    
    // Check if date is in the past using timezone-aware comparison
    const currentDate = moment().tz(timezone).startOf('day');
    
    if (searchMoment.isBefore(currentDate)) {
      return res.status(404).json({ message: "No consignments available for past dates." });
    }

    // Create date range for search using proper timezone handling
    // For IST (UTC+5:30), we need to ensure we cover the full day in the user's timezone
    const startOfDay = moment.tz(date, timezone).startOf('day').utc().toDate();
    
    // Calculate end of day properly to cover the full day in user's timezone
    // We need to add 1 day to the start and subtract 1 millisecond to get the end of the current day
    const endOfDay = moment.tz(date, timezone).add(1, 'day').startOf('day').subtract(1, 'millisecond').utc().toDate();
    
    // Debug: Verify the date range covers the correct day
    console.log('Date range verification:', {
      inputDate: date,
      timezone: timezone,
      startOfDayUTC: startOfDay.toISOString(),
      endOfDayUTC: endOfDay.toISOString(),
      startOfDayLocal: moment.utc(startOfDay).tz(timezone).format('YYYY-MM-DD HH:mm:ss'),
      endOfDayLocal: moment.utc(endOfDay).tz(timezone).format('YYYY-MM-DD HH:mm:ss'),
      coversCorrectDay: moment.utc(startOfDay).tz(timezone).format('YYYY-MM-DD') === date && 
                       moment.utc(endOfDay).tz(timezone).format('YYYY-MM-DD') === date,
      fullDayCoverage: moment.utc(startOfDay).tz(timezone).format('HH:mm:ss') === '00:00:00' &&
                      moment.utc(endOfDay).tz(timezone).format('HH:mm:ss') === '23:59:59'
    });
    
    console.log('Date range for search:', {
      originalDate: date,
      timezone: timezone,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      startOfDayLocal: searchMoment.startOf('day').format(),
      endOfDayLocal: searchMoment.endOf('day').format()
    });
    // Search for all user's travels on the specified date
    // First try to find by travelDate (string) and expectedStartTime range
    const normalizedDate = moment.tz(date, timezone).format('YYYY-MM-DD');
    let userTravels = await Traveldetails.find({
      phoneNumber: normalizedPhoneNumber,
      travelDate: normalizedDate,
      status: { $nin: ["Cancelled", "Completed"] } // Only get valid travels
    }).sort({ updatedAt: -1 });
    
    // If not found by travelDate, try by expectedStartTime range
    if (userTravels.length === 0) {
      userTravels = await Traveldetails.find({
        phoneNumber: normalizedPhoneNumber,
        expectedStartTime: {
          $gte: startOfDay.toISOString(),
          $lt: endOfDay.toISOString()
        },
        status: { $nin: ["Cancelled", "Completed"] } // Only get valid travels
      }).sort({ updatedAt: -1 });
    }
    console.log("userTravels found:", userTravels.length);
    console.log("Travel search details:", {
      searchDate: date,
      normalizedDate: normalizedDate,
      startOfDayISO: startOfDay.toISOString(),
      endOfDayISO: endOfDay.toISOString(),
      phoneNumber: normalizedPhoneNumber
    });
    
    if (userTravels.length === 0) {
      return res.status(404).json({ 
        message: "No valid travels found for the specified date. Please publish your travel first.",
        searchDetails: {
          date: date,
          timezone: timezone,
          normalizedDate: normalizedDate,
          startOfDay: startOfDay.toISOString(),
          endOfDay: endOfDay.toISOString()
        }
      });
    }

    // Use the first travel for coordinate matching (assuming all travels have similar routes)
    const userTravel = userTravels[0];

    // Validate travel mode and map roadways to car for price calculation
    const validModes = ["train", "airplane", "car", "roadways"];
    const travelMode = userTravel.travelMode ? userTravel.travelMode.toLowerCase().trim() : null;

    if (!validModes.includes(travelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train', 'airplane', 'car', or 'roadways'." });
    }

    // Map roadways to car for price calculation
    const priceCalculationMode = travelMode === "roadways" ? "car" : travelMode;

    // Get coordinates for the search parameters (not user's travel coordinates)
    const searchLeavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
    const searchGoingCoords = await mapservice.getAddressCoordinate(goingLocation);

    if (!searchLeavingCoords || !searchGoingCoords) {
      return res.status(400).json({ message: "Unable to get coordinates for search locations. Please check the locations." });
    }

    console.log("Using search parameters for coordinate matching:");
    console.log("Search Starting:", leavingLocation, "->", searchLeavingCoords);
    console.log("Search Ending:", goingLocation, "->", searchGoingCoords);
    
    // Validate that search parameters match user's travel (optional validation)
    console.log("Search parameters validation:");
    console.log("Search leavingLocation:", leavingLocation);
    console.log("User travel leavingLocation:", userTravel.Leavinglocation);
    console.log("Search goingLocation:", goingLocation);
    console.log("User travel goingLocation:", userTravel.Goinglocation);

   

    const radiusInMeters = 10 * 1000; // 10km

    const leavingBoundingBox = getBoundingBox(
      { latitude: searchLeavingCoords.ltd, longitude: searchLeavingCoords.lng },
      radiusInMeters
    );

    const goingBoundingBox = getBoundingBox(
      { latitude: searchGoingCoords.ltd, longitude: searchGoingCoords.lng },
      radiusInMeters
    );

    // First try exact coordinate matching
    const exactQuery = {
      "LeavingCoordinates.latitude": searchLeavingCoords.ltd,
      "LeavingCoordinates.longitude": searchLeavingCoords.lng,
      "GoingCoordinates.latitude": searchGoingCoords.ltd,
      "GoingCoordinates.longitude": searchGoingCoords.lng,
      dateOfSending: { $gte: startOfDay, $lt: endOfDay },
      phoneNumber: { $ne: normalizedPhoneNumber }
    };

    let exactConsignments = await Consignment.find(exactQuery).lean();
    console.log("Found consignments with exact coordinate matching:", exactConsignments.length);

    // If no exact matches, try 10km radius matching
    if (exactConsignments.length === 0) {
      const radiusQuery = {
        dateOfSending: { $gte: startOfDay, $lt: endOfDay },
        phoneNumber: { $ne: normalizedPhoneNumber }
      };

      const allConsignmentsForRadius = await Consignment.find(radiusQuery).lean();
      
      exactConsignments = allConsignmentsForRadius.filter(consignment => {
        const leavingDistance = geolib.getDistance(
          { latitude: searchLeavingCoords.ltd, longitude: searchLeavingCoords.lng },
          { latitude: consignment.LeavingCoordinates.latitude, longitude: consignment.LeavingCoordinates.longitude }
        );

        const goingDistance = geolib.getDistance(
          { latitude: searchGoingCoords.ltd, longitude: searchGoingCoords.lng },
          { latitude: consignment.GoingCoordinates.latitude, longitude: consignment.GoingCoordinates.longitude }
        );

        const radiusInMeters = 10 * 1000; // 10km
        return leavingDistance <= radiusInMeters && goingDistance <= radiusInMeters;
      });
      
      console.log("Found consignments with 10km radius matching:", exactConsignments.length);
    }

    // If no exact matches, try bounding box approach
    const baseQuery = {
      "LeavingCoordinates.latitude": { $gte: leavingBoundingBox.minLat, $lte: leavingBoundingBox.maxLat },
      "LeavingCoordinates.longitude": { $gte: leavingBoundingBox.minLng, $lte: leavingBoundingBox.maxLng },
      "GoingCoordinates.latitude": { $gte: goingBoundingBox.minLat, $lte: goingBoundingBox.maxLat },
      "GoingCoordinates.longitude": { $gte: goingBoundingBox.minLng, $lte: goingBoundingBox.maxLng },
      dateOfSending: { $gte: startOfDay, $lt: endOfDay },
      phoneNumber: { $ne: normalizedPhoneNumber }
    };

    // Use exact consignments if found, otherwise use bounding box approach
    let availableConsignments = exactConsignments;
    
    if (exactConsignments.length === 0) {
      availableConsignments = await Consignment.find(baseQuery).lean();
    }
    
    console.log("Found consignments before distance filtering:", availableConsignments.length);
    
    // Debug: Check all consignments for the date without location filtering
    const allConsignmentsForDate = await Consignment.find({
      dateOfSending: { $gte: startOfDay, $lt: endOfDay },
      phoneNumber: { $ne: normalizedPhoneNumber }
    }).lean();
    console.log("Total consignments for the date (without location filter):", allConsignmentsForDate.length);
    
    if (allConsignmentsForDate.length > 0) {
      console.log("Sample consignments for the date:", allConsignmentsForDate.slice(0, 3).map(consignment => ({
        consignmentId: consignment.consignmentId,
        startingLocation: consignment.startinglocation,
        goingLocation: consignment.goinglocation,
        leavingCoords: consignment.LeavingCoordinates,
        goingCoords: consignment.GoingCoordinates
      })));
    }

    // Apply precise distance filtering and direction validation (skip if we have exact matches)
    let filteredConsignments = availableConsignments;
    
    if (exactConsignments.length === 0) {
      filteredConsignments = availableConsignments.filter(consignment => {
        const leavingDistance = geolib.getDistance(
          { latitude: searchLeavingCoords.ltd, longitude: searchLeavingCoords.lng },
          { latitude: consignment.LeavingCoordinates.latitude, longitude: consignment.LeavingCoordinates.longitude }
        );

        const goingDistance = geolib.getDistance(
          { latitude: searchGoingCoords.ltd, longitude: searchGoingCoords.lng },
          { latitude: consignment.GoingCoordinates.latitude, longitude: consignment.GoingCoordinates.longitude }
        );

        // Use a reasonable radius for precise matching (10km)
        const preciseRadiusInMeters = 10 * 1000; // 10km
        const distanceMatch = leavingDistance <= preciseRadiusInMeters && goingDistance <= preciseRadiusInMeters;
        
        // Add direction validation - ensure consignment direction matches search direction
        // Compare the actual location names to ensure direction matches
        const normalizeLocation = (location) => {
          return location.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters except spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        };
        
        const normalizedSearchLeaving = normalizeLocation(leavingLocation);
        const normalizedSearchGoing = normalizeLocation(goingLocation);
        const normalizedConsignmentStarting = normalizeLocation(consignment.startinglocation);
        const normalizedConsignmentGoing = normalizeLocation(consignment.goinglocation);
        
        // Extract key location words (cities, states, etc.)
        const extractKeyWords = (location) => {
          const words = location.split(' ').filter(word => word.length > 2);
          return words;
        };
        
        const searchLeavingWords = extractKeyWords(normalizedSearchLeaving);
        const searchGoingWords = extractKeyWords(normalizedSearchGoing);
        const consignmentStartingWords = extractKeyWords(normalizedConsignmentStarting);
        const consignmentGoingWords = extractKeyWords(normalizedConsignmentGoing);
        
        // Check for word overlap (more flexible matching)
        const hasWordOverlap = (words1, words2) => {
          return words1.some(word1 => 
            words2.some(word2 => 
              word1.includes(word2) || word2.includes(word1)
            )
          );
        };
        
        // Direction validation: consignment starting location should match search leaving location
        // AND consignment going location should match search going location
        const startingLocationMatch = hasWordOverlap(searchLeavingWords, consignmentStartingWords) ||
                                    normalizedConsignmentStarting.includes(normalizedSearchLeaving) ||
                                    normalizedSearchLeaving.includes(normalizedConsignmentStarting);
        
        const goingLocationMatch = hasWordOverlap(searchGoingWords, consignmentGoingWords) ||
                                 normalizedConsignmentGoing.includes(normalizedSearchGoing) ||
                                 normalizedSearchGoing.includes(normalizedConsignmentGoing);
        
        const directionMatch = startingLocationMatch && goingLocationMatch;
        
        console.log("Distance and direction check for consignment:", {
          consignmentId: consignment.consignmentId,
          consignmentDirection: `${consignment.startinglocation} -> ${consignment.goinglocation}`,
          searchDirection: `${leavingLocation} -> ${goingLocation}`,
          normalizedConsignmentStarting,
          normalizedConsignmentGoing,
          normalizedSearchLeaving,
          normalizedSearchGoing,
          consignmentStartingWords,
          consignmentGoingWords,
          searchLeavingWords,
          searchGoingWords,
          startingLocationMatch,
          goingLocationMatch,
          distanceMatch,
          directionMatch,
          leavingCoords: consignment.LeavingCoordinates,
          goingCoords: consignment.GoingCoordinates,
          searchLeavingCoords: searchLeavingCoords,
          searchGoingCoords: searchGoingCoords
        });

        return distanceMatch && directionMatch;
      });
    } else {
      console.log("Using exact coordinate matches, skipping distance filtering");
    }

    // Filter out consignments that are already accepted/booked
    const acceptedConsignmentIds = await riderequest.find({ status: "Accepted" }).distinct('consignmentId');
    filteredConsignments = filteredConsignments.filter(consignment => !acceptedConsignmentIds.includes(consignment.consignmentId));
    for(let i = 0; i<filteredConsignments.length; i++){
      console.log("Available consignments after filtering accepted ones:", filteredConsignments[i]);
    }

    // Filter out consignments with certain statuses
    filteredConsignments = filteredConsignments.filter(consignment => 
      !consignment.status || !["Accepted", "Rejected", "Expired", "Completed"].includes(consignment.status)
    );
    console.log("Available consignments after filtering by status:", filteredConsignments.length);

    console.log("Available consignments after filtering:", filteredConsignments.length);
    
    console.log("Consignments after distance filtering:", filteredConsignments.length);
    
    if (!filteredConsignments.length) {
      // Debug: Check if there are any consignments for the date without location filtering
      const allConsignmentsForDate = await Consignment.find({
        dateOfSending: {
          $gte: startOfDay,
          $lt: endOfDay
        },
        phoneNumber: { $ne: normalizedPhoneNumber }
      });
      
      console.log("Debug - All consignments for date (no location filter):", allConsignmentsForDate.length);
      if (allConsignmentsForDate.length > 0) {
        console.log("Sample consignments for date:", allConsignmentsForDate.slice(0, 3).map(con => ({
          consignmentId: con.consignmentId,
          startingLocation: con.startinglocation,
          goingLocation: con.goinglocation,
          leavingCoords: con.LeavingCoordinates,
          goingCoords: con.GoingCoordinates,
          dateOfSending: con.dateOfSending
        })));
      }
      
      // Try alternative matching: check if any consignments have the same location names
      console.log("No consignments found with coordinate matching, trying location name matching...");
      
      const alternativeConsignments = allConsignmentsForDate.filter(consignment => {
        // Clean and normalize location strings for better matching
        const normalizeLocation = (location) => {
          return location.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters except spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        };
        
        const normalizedSearchLeaving = normalizeLocation(leavingLocation);
        const normalizedSearchGoing = normalizeLocation(goingLocation);
        const normalizedConsignmentStarting = normalizeLocation(consignment.startinglocation);
        const normalizedConsignmentGoing = normalizeLocation(consignment.goinglocation);
        
        // Extract key location words (cities, states, etc.)
        const extractKeyWords = (location) => {
          const words = location.split(' ').filter(word => word.length > 2);
          return words;
        };
        
        const searchLeavingWords = extractKeyWords(normalizedSearchLeaving);
        const searchGoingWords = extractKeyWords(normalizedSearchGoing);
        const consignmentStartingWords = extractKeyWords(normalizedConsignmentStarting);
        const consignmentGoingWords = extractKeyWords(normalizedConsignmentGoing);
        
        // Check for word overlap (more flexible matching)
        const hasWordOverlap = (words1, words2) => {
          return words1.some(word1 => 
            words2.some(word2 => 
              word1.includes(word2) || word2.includes(word1)
            )
          );
        };
        
        const leavingMatch = hasWordOverlap(searchLeavingWords, consignmentStartingWords) ||
                           normalizedConsignmentStarting.includes(normalizedSearchLeaving) ||
                           normalizedSearchLeaving.includes(normalizedConsignmentStarting);
        
        const goingMatch = hasWordOverlap(searchGoingWords, consignmentGoingWords) ||
                          normalizedConsignmentGoing.includes(normalizedSearchGoing) ||
                          normalizedSearchGoing.includes(normalizedConsignmentGoing);
        
        // Additional direction validation for alternative matching
        // Ensure the consignment direction matches the search direction
        const directionMatch = leavingMatch && goingMatch;
        
        console.log("Alternative matching for consignment:", {
          consignmentId: consignment.consignmentId,
          consignmentStarting: consignment.startinglocation,
          consignmentGoing: consignment.goinglocation,
          searchLeaving: leavingLocation,
          searchGoing: goingLocation,
          normalizedConsignmentStarting,
          normalizedConsignmentGoing,
          normalizedSearchLeaving,
          normalizedSearchGoing,
          consignmentStartingWords,
          consignmentGoingWords,
          searchLeavingWords,
          searchGoingWords,
          leavingMatch,
          goingMatch
        });
        
        return directionMatch;
      });
      
      // Filter out accepted consignments from alternative consignments as well
      const acceptedConsignmentIdsForAlternative = await riderequest.find({ status: "Accepted" }).distinct('consignmentId');
      const filteredAlternativeConsignments = alternativeConsignments.filter(consignment => 
        !acceptedConsignmentIdsForAlternative.includes(consignment.consignmentId)
      );
      
      // Also filter out consignments with certain statuses
      const finalAlternativeConsignments = filteredAlternativeConsignments.filter(consignment => 
        !consignment.status || !["Accepted", "Rejected", "Expired", "Completed"].includes(consignment.status)
      );
      
      console.log("Alternative consignments after filtering accepted ones:", finalAlternativeConsignments.length);
      
      if (finalAlternativeConsignments.length > 0) {
        console.log("Found consignments using location name matching:", finalAlternativeConsignments.length);
        // Use alternative consignments for price calculation
        const alternativeConsignmentsWithPrice = await Promise.all(finalAlternativeConsignments.map(async (consignment) => {
          try {
            const weight = parseFloat(consignment.weight?.toString().replace(/[^\d.]/g, ""));
            const distance = parseFloat(consignment.distance?.toString().replace(/[^\d.]/g, ""));

            if (isNaN(weight) || isNaN(distance)) {
              return {
                ...consignment,
                availableTravels: userTravels.map(travel => ({
                  travelId: travel.travelId,
                  travelMode: travel.travelMode,
                  vehicleType: travel.vehicleType,
                  expectedStartTime: travel.expectedStartTime,
                  expectedEndTime: travel.expectedEndTime,
                  status: travel.status,
                  calculatedPrice: null,
                  priceError: "Invalid weight or distance"
                })),
                matchType: "location_name"
              };
            }

            const dimensions = consignment.dimensions;
            const length = dimensions?.length;
            const height = dimensions?.height;
            const breadth = dimensions?.breadth;

            // Calculate prices for each travel mode separately
            const availableTravelsWithPrices = await Promise.all(userTravels.map(async (travel) => {
              try {
                // Validate travel mode for each travel
                const validModes = ["train", "airplane", "car", "roadways"];
                const travelMode = travel.travelMode ? travel.travelMode.toLowerCase().trim() : null;

                if (!validModes.includes(travelMode)) {
                  return {
                    travelId: travel.travelId,
                    travelMode: travel.travelMode,
                    vehicleType: travel.vehicleType,
                    expectedStartTime: travel.expectedStartTime,
                    expectedEndTime: travel.expectedEndTime,
                    status: travel.status,
                    calculatedPrice: null,
                    priceError: "Invalid travel mode"
                  };
                }

                // Map roadways to car for price calculation
                const priceCalculationMode = travelMode === "roadways" ? "car" : travelMode;

                // Calculate fare for this specific travel mode
                const {senderTotalPay, totalFare} = await fare.calculateFare(
                  weight, 
                  distance, 
                  priceCalculationMode, 
                  length, 
                  height, 
                  breadth
                ) ?? {};

                if(isNaN(senderTotalPay) || isNaN(totalFare)){
                  return {
                    travelId: travel.travelId,
                    travelMode: travel.travelMode,
                    vehicleType: travel.vehicleType,
                    expectedStartTime: travel.expectedStartTime,
                    expectedEndTime: travel.expectedEndTime,
                    status: travel.status,
                    calculatedPrice: null,
                    priceError: "Error in fare calculation"
                  };
                }

                return {
                  travelId: travel.travelId,
                  travelMode: travel.travelMode,
                  vehicleType: travel.vehicleType,
                  expectedStartTime: travel.expectedStartTime,
                  expectedEndTime: travel.expectedEndTime,
                  status: travel.status,
                  calculatedPrice: {senderTotalPay, totalFare},
                  priceCalculationMode: priceCalculationMode
                };

              } catch (error) {
                console.error(`Error calculating price for travel ${travel.travelId}:`, error);
                return {
                  travelId: travel.travelId,
                  travelMode: travel.travelMode,
                  vehicleType: travel.vehicleType,
                  expectedStartTime: travel.expectedStartTime,
                  expectedEndTime: travel.expectedEndTime,
                  status: travel.status,
                  calculatedPrice: null,
                  priceError: error.message
                };
              }
            }));

            return {
              ...consignment,
              availableTravels: availableTravelsWithPrices,
              matchType: "location_name"
            };

          } catch (error) {
            console.error(`Error calculating price for consignment ${consignment.consignmentId}:`, error);
            return {
              ...consignment,
              availableTravels: userTravels.map(travel => ({
                travelId: travel.travelId,
                travelMode: travel.travelMode,
                vehicleType: travel.vehicleType,
                expectedStartTime: travel.expectedStartTime,
                expectedEndTime: travel.expectedEndTime,
                status: travel.status,
                calculatedPrice: null,
                priceError: error.message
              })),
              matchType: "location_name"
            };
          }
        }));

        return res.status(200).json({
          message: "Consignments found with location name matching",
          consignments: alternativeConsignmentsWithPrice,
          userTravels: userTravels.map(travel => ({
            travelId: travel.travelId,
            travelMode: travel.travelMode,
            vehicleType: travel.vehicleType,
            travelDate: travel.travelDate,
            expectedStartTime: travel.expectedStartTime,
            expectedEndTime: travel.expectedEndTime,
            Leavinglocation: travel.Leavinglocation,
            Goinglocation: travel.Goinglocation,
            distance: travel.distance,
            duration: travel.duration,
            status: travel.status,
            expectedearning: travel.expectedearning
          })),
          userTravelDetails: {
            travelMode: travelMode,
            priceCalculationMode: priceCalculationMode,
            travelId: userTravel.travelId,
            travelDate: userTravel.travelDate
          },
          matchType: "location_name"
        });
      }
      
      return res.status(404).json({ 
        message: "No consignments found for the given date and locations.",
        debug: {
          totalConsignmentsForDate: allConsignmentsForDate.length,
          searchParams: {
            leavingLocation,
            goingLocation,
            date,
            normalizedPhoneNumber
          }
        }
      });
    }

    // Calculate actual price for each consignment using .map
    const consignmentsWithPrice = await Promise.all(filteredConsignments.map(async (consignment) => {
      try {
        // Extract weight and distance from consignment
        const weight = parseFloat(consignment.weight?.toString().replace(/[^\d.]/g, ""));
        const distance = parseFloat(consignment.distance?.toString().replace(/[^\d.]/g, ""));

        if (isNaN(weight) || isNaN(distance)) {
          console.log(`Invalid weight or distance for consignment ${consignment.consignmentId}`);
          return {
            ...consignment,
            calculatedPrice: null,
            priceError: "Invalid weight or distance"
          };
        }

        // Extract dimensions if available
        const dimensions = consignment.dimensions;
        const length = dimensions?.length;
        const height = dimensions?.height;
        const breadth = dimensions?.breadth;

        // Calculate prices for each travel mode separately
        const availableTravelsWithPrices = await Promise.all(userTravels.map(async (travel) => {
          try {
            // Validate travel mode for each travel
            const validModes = ["train", "airplane", "car", "roadways"];
            const travelMode = travel.travelMode ? travel.travelMode.toLowerCase().trim() : null;

            if (!validModes.includes(travelMode)) {
              return {
                travelId: travel.travelId,
                travelMode: travel.travelMode,
                vehicleType: travel.vehicleType,
                expectedStartTime: travel.expectedStartTime,
                expectedEndTime: travel.expectedEndTime,
                status: travel.status,
                calculatedPrice: null,
                priceError: "Invalid travel mode"
              };
            }

            // Map roadways to car for price calculation
            const priceCalculationMode = travelMode === "roadways" ? "car" : travelMode;

            // Calculate fare for this specific travel mode
            const {senderTotalPay, totalFare} = await fare.calculateFare(
              weight, 
              distance, 
              priceCalculationMode, 
              length, 
              height, 
              breadth
            ) ?? {};

            if(isNaN(senderTotalPay) || isNaN(totalFare)){
              return {
                travelId: travel.travelId,
                travelMode: travel.travelMode,
                vehicleType: travel.vehicleType,
                expectedStartTime: travel.expectedStartTime,
                expectedEndTime: travel.expectedEndTime,
                status: travel.status,
                calculatedPrice: null,
                priceError: "Error in fare calculation"
              };
            }

            return {
              travelId: travel.travelId,
              travelMode: travel.travelMode,
              vehicleType: travel.vehicleType,
              expectedStartTime: travel.expectedStartTime,
              expectedEndTime: travel.expectedEndTime,
              status: travel.status,
              calculatedPrice: {senderTotalPay, totalFare},
              priceCalculationMode: priceCalculationMode
            };

          } catch (error) {
            console.error(`Error calculating price for travel ${travel.travelId}:`, error);
            return {
              travelId: travel.travelId,
              travelMode: travel.travelMode,
              vehicleType: travel.vehicleType,
              expectedStartTime: travel.expectedStartTime,
              expectedEndTime: travel.expectedEndTime,
              status: travel.status,
              calculatedPrice: null,
              priceError: error.message
            };
          }
        }));

        return {
          ...consignment,
          availableTravels: availableTravelsWithPrices
        };

      } catch (error) {
        console.error(`Error calculating price for consignment ${consignment.consignmentId}:`, error);
        return {
          ...consignment,
          availableTravels: userTravels.map(travel => ({
            travelId: travel.travelId,
            travelMode: travel.travelMode,
            vehicleType: travel.vehicleType,
            expectedStartTime: travel.expectedStartTime,
            expectedEndTime: travel.expectedEndTime,
            status: travel.status,
            calculatedPrice: null,
            priceError: error.message
          }))
        };
      }
    }));

    // Return consignments with calculated prices and all user travels
    res.status(200).json({
      message: "Consignments found with calculated prices",
      consignments: consignmentsWithPrice,
      userTravels: userTravels.map(travel => ({
        travelId: travel.travelId,
        travelMode: travel.travelMode,
        vehicleType: travel.vehicleType,
        travelDate: travel.travelDate,
        expectedStartTime: travel.expectedStartTime,
        expectedEndTime: travel.expectedEndTime,
        Leavinglocation: travel.Leavinglocation,
        Goinglocation: travel.Goinglocation,
        distance: travel.distance,
        duration: travel.duration,
        status: travel.status,
        expectedearning: travel.expectedearning
      })),
      userTravelDetails: {
        travelMode: travelMode,
        priceCalculationMode: priceCalculationMode,
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

    // Check if consignment is already accepted by another traveler
    const existingAcceptedRequest = await riderequest.findOne({
      consignmentId,
      status: "Accepted",
    });
    if (existingAcceptedRequest) {
      return res.status(400).json({ message: "Consignment has already been accepted by another traveler." });
    }

    // Check if consignment status is already set to accepted/rejected/expired/completed
    if (con.status && ["Accepted", "Rejected", "Expired", "Completed"].includes(con.status)) {
      return res.status(400).json({ message: `Consignment is already ${con.status.toLowerCase()}.` });
    }
    const Ride = await Traveldetails.findOne({ phoneNumber }).sort({ updatedAt: -1 });

    if (!Ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const validModes = ["train", "airplane", "car", "roadways"];
    const travelMode = Ride.travelMode ? Ride.travelMode.toLowerCase().trim() : null;

    if (!validModes.includes(travelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train', 'airplane', 'car', or 'roadways'." });
    }

    // Map roadways to car for price calculation
    const priceCalculationMode = travelMode === "roadways" ? "car" : travelMode;
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

    const expectedEarning = await fare.calculateFare(weight, distance, priceCalculationMode);


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
    const { 
      phoneNumber, 
      consignmentId, 
      travelId, 
      travelMode: frontendTravelMode, 
      vehicleType, 
      calculatedPrice, 
      weight: frontendWeight, 
      distance: frontendDistance 
    } = req.body;

    console.log("getearning request payload:", req.body);

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

    // Check if consignment is already accepted by another traveler
    const existingAcceptedRequest2 = await riderequest.findOne({
      consignmentId,
      status: "Accepted",
    });
    if (existingAcceptedRequest2) {
      return res.status(400).json({ message: "Consignment has already been accepted by another traveler." });
    }

    // Check if consignment status is already set to accepted/rejected/expired/completed
    if (con.status && ["Accepted", "Expired", "Completed"].includes(con.status)) {
      return res.status(400).json({ message: `Consignment is already ${con.status.toLowerCase()}.` });
    }

    // Use travelId if provided, otherwise find the latest ride
    let Ride;
    if (travelId) {
      Ride = await Traveldetails.findOne({ travelId, phoneNumber });
      if (!Ride) {
        return res.status(404).json({ message: "Travel not found with the provided travelId." });
      }
    } else {
      Ride = await Traveldetails.findOne({ phoneNumber }).sort({ updatedAt: -1 });
      if (!Ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
    }


    // Use actual travel dates instead of creation timestamps
    const consignmentDate = new Date(con.dateOfSending).toISOString().split('T')[0]; // Get YYYY-MM-DD
    const rideDate = Ride.travelDate; // Already in YYYY-MM-DD format
    console.log(Ride.travelDate)
    
    console.log("Date comparison:", {
      consignmentDate,
      rideDate,
      consignmentDateOfSending: con.dateOfSending,
      rideTravelDate: Ride.travelDate
    });
    
    if (consignmentDate !== rideDate) {
      return res.status(400).json({ 
        message: "Travel date mismatch. Please publish travel for the same date as the consignment.",
        debug: {
          consignmentDate,
          rideDate,
          consignmentDateOfSending: con.dateOfSending,
          rideTravelDate: Ride.travelDate
        }
      });
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

    console.log("Earning validation - Distance check:", {
      consignmentId: con.consignmentId,
      riderStartPoint,
      pickup,
      boundingBox,
      isWithinBox,
      distance: geolib.getDistance(riderStartPoint, pickup)
    });

    if (!isWithinBox) {
      return res.status(400).json({
        message: "Consignment pickup location is outside the 10 km radius of your starting location.",
        debug: {
          riderStartPoint,
          pickup,
          boundingBox,
          actualDistance: geolib.getDistance(riderStartPoint, pickup)
        }
      });
    }


    // Check if consignment destination matches ride destination
    // if (con.goinglocation !== Ride.Goinglocation) {
    //   return res.status(400).json({ message: "Consignment destination does not match ride destination." });
    // }

    // Check if consignment is already accepted by another traveler
    const existingAcceptedRequest3 = await riderequest.findOne({
      consignmentId,
      status: "Accepted",
    });
    if (existingAcceptedRequest3) {
      return res.status(400).json({ message: "Consignment has already been accepted by another traveler." });
    }

    // Use frontend-calculated prices if available, otherwise calculate on backend
    let expectedEarning;
    
    if (calculatedPrice && calculatedPrice.senderTotalPay && calculatedPrice.totalFare) {
      // Use frontend-calculated prices
      console.log("Using frontend-calculated prices:", calculatedPrice);
      expectedEarning = {
        senderTotalPay: parseFloat(calculatedPrice.senderTotalPay),
        totalFare: parseFloat(calculatedPrice.totalFare)
      };
    } else {
      // Fallback to backend calculation
      console.log("Frontend prices not available, calculating on backend...");
      
      const validModes = ["train", "airplane", "car", "roadways"];
      const travelMode = Ride.travelMode ? Ride.travelMode.toLowerCase().trim() : "car";

      if (!validModes.includes(travelMode)) {
        return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train', 'airplane', 'car', or 'roadways'." });
      }

      // Map roadways to car for price calculation
      const priceCalculationMode = travelMode === "roadways" ? "car" : travelMode;

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

      expectedEarning = await fare.calculateFare(Weight, distance, priceCalculationMode);
    }
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
    }).sort({ createdAt: -1 }).lean();

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


    await Promise.all([
      Notification.updateMany(
        { travelId, consignmentId },
        { $set: { paymentstatus: 'declined' } }
      ),
      Consignment.updateOne(
        { consignmentId },
        { $set: { paymentStatus: 'declined' } }
      )
    ]);


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







