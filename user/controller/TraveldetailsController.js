const Traveldetails = require('../../user/model/traveldetails');
const mapservice = require('../../service/mapservice');
const userprofiles = require('../../user/model/Profile');
const fare = require('../../service/price.service');
const { v4: uuidv4 } = require('uuid');
const consignmentData = require('../../consignment/model/contraveldetails');
const Request = require('../../user/model/requestforcarry');
const travelhistory = require("../../user/model/travel.history");
const moment = require("moment-timezone");
const { getIO, sendMessageToSocketId } = require('../../socket');
const Notification = require('../../user/model/notification')
const datetime = require('../../service/getcurrentdatetime')
const TimezoneService = require('../../service/timezoneService');
// const User = require('../model/User');
// const con = require('../../consignment/model/conhistory')

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



exports.getAutoCompleteAndCreateBooking = async (req, res) => {
  let { phoneNumber, travelDate, vehicleType, stayDays, stayHours, endDate, travelmode_number, travelMode, expectedStartTime, expectedEndTime, weight, fullFrom, fullTo, userTimezone } = req.body;
  const { Leavinglocation, Goinglocation } = req.query;
  
  // Set default timezone if not provided
  userTimezone = userTimezone || 'Asia/Kolkata';
  
  const user = await userprofiles.findOne({ phoneNumber });
  console.log("Fetched User:", user);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!Leavinglocation || !Goinglocation) {
    return res.status(400).json({ message: "Leaving and Going locations are required" });
  }

  // Validate and normalize dates with timezone handling
  let normalizedTravelDate, normalizedEndDate;
  
  try {
    normalizedTravelDate = TimezoneService.validateAndNormalizeDate(travelDate, userTimezone);
    normalizedEndDate = TimezoneService.validateAndNormalizeDate(endDate, userTimezone);
    
    console.log("Date validation:", {
      original: { travelDate, endDate },
      normalized: {
        travelDate: normalizedTravelDate,
        endDate: normalizedEndDate
      }
    });
    
    // Check if travel date is in the past
    const currentDate = moment().tz(userTimezone).startOf('day');
    if (normalizedTravelDate.dateObj < currentDate.toDate()) {
      return res.status(400).json({ message: "Travel date cannot be in the past" });
    }
    
  } catch (error) {
    return res.status(400).json({ 
      message: "Invalid date format", 
      error: error.message,
      expectedFormat: "YYYY-MM-DD"
    });
  }

  try {
    const LeavingCoordinates = await mapservice.getAddressCoordinate(Leavinglocation);
    const GoingCoordinates = await mapservice.getAddressCoordinate(Goinglocation);

    if (!LeavingCoordinates) {
      return res.status(400).json({ message: "Unable to fetch coordinates for Leaving location" });
    }

    if (!GoingCoordinates) {
      return res.status(400).json({ message: "Unable to fetch coordinates for Going location" });
    }

    const weightValue = weight ? parseFloat(weight) : 1;
    const { distance, duration } = await mapservice.getDistanceTime(Leavinglocation, Goinglocation);
    const distanceText = distance.text;
    const durationText = duration.text;

    const username = `${user.firstName} ${user.lastName}`;
    const userrating = user.userrating;
    const totalrating = user.totalrating;
    const distanceValue = parseFloat(distance.text.replace(/[^\d.]/g, ""));

    if (isNaN(distanceValue)) {
      return res.status(400).json({ message: "Invalid distance received from map service" });
    }

    const rideId = uuidv4();
    const travelId = Math.floor(100000000 + Math.random() * 900000000).toString();

    // Parse expected start and end times with proper timezone handling
    let expectedStart, expectedEnd;
    
    try {
      expectedStart = TimezoneService.parseDateTimeWithTimezone(normalizedTravelDate.date, expectedStartTime, userTimezone);
      expectedEnd = TimezoneService.parseDateTimeWithTimezone(normalizedEndDate.date, expectedEndTime, userTimezone);
      
      console.log("Time parsing results:", {
        input: {
          travelDate: normalizedTravelDate.date,
          expectedStartTime,
          endDate: normalizedEndDate.date,
          expectedEndTime,
          userTimezone
        },
        output: {
          expectedStart,
          expectedEnd,
          expectedStartLocal: moment.utc(expectedStart).tz(userTimezone).format(),
          expectedEndLocal: moment.utc(expectedEnd).tz(userTimezone).format()
        }
      });
      
      // Validate that end time is after start time
      if (moment.utc(expectedEnd).isSameOrBefore(moment.utc(expectedStart))) {
        return res.status(400).json({ 
          message: "Expected end time must be after expected start time" 
        });
      }
      
    } catch (error) {
      console.error("Time parsing failed:", error.message);
      return res.status(400).json({ 
        message: "Invalid time format", 
        error: error.message,
        expectedFormat: "hh:mm AM/PM"
      });
    }

    // Create travel details object
    let travelDetails = {
      stayDays,
      stayHours,
      vehicleType,
      endDate: normalizedEndDate.date, // Store as date string
      phoneNumber,
      username,
      Leavinglocation,
      Goinglocation,
      fullFrom,
      fullTo,
      travelDate: normalizedTravelDate.date, // Store as date string
      travelmode_number,
      travelMode,
      expectedStartTime: expectedStart, // Store as UTC ISO string
      expectedEndTime: expectedEnd, // Store as UTC ISO string
      distance: distanceText,
      duration: durationText,
      userrating,
      totalrating,
      rideId,
      travelId,
      LeavingCoordinates: {
        ltd: LeavingCoordinates.ltd,
        lng: LeavingCoordinates.lng
      },
      GoingCoordinates: {
        ltd: GoingCoordinates.ltd,
        lng: GoingCoordinates.lng
      }
    };
    
    console.log("Final travel details:", {
      travelDate: travelDetails.travelDate,
      endDate: travelDetails.endDate,
      expectedStartTime: travelDetails.expectedStartTime,
      expectedEndTime: travelDetails.expectedEndTime,
      userTimezone
    });

    const travelRecord = await Traveldetails.create(travelDetails);
    console.log("Created travel record:", travelRecord);

    // Determine travel status based on current time
    const now = moment().utc();
    let Status = "UPCOMING";
    if (now.isBetween(moment.utc(expectedStart), moment.utc(expectedEnd))) {
      Status = "Ongoing";
    } else if (now.isAfter(moment.utc(expectedEnd))) {
      Status = "EXPIRED";
    }
    
    console.log("Travel status:", Status);
    
    const history = new travelhistory({
      phoneNumber,
      vehicleType: vehicleType,
      travelId: travelId,
      travelMode: travelMode,
      username: username,
      travelmode_number: travelmode_number,
      fullFrom: fullFrom,
      fullTo: fullTo,
      pickup: Leavinglocation,
      drop: Goinglocation,
      expectedStartTime: expectedStart,
      expectedendtime: expectedEnd,
      status: Status
    });

    await history.save();
    console.log("Created history record:", history);

    return res.status(201).json({
      message: "Travel detail created successfully",
      travelRecord: {
        ...travelRecord._doc,
        distance,
        duration,
        travelId,
        // Include timezone info for client
        timezoneInfo: {
          userTimezone,
          expectedStartLocal: moment.utc(expectedStart).tz(userTimezone).format(),
          expectedEndLocal: moment.utc(expectedEnd).tz(userTimezone).format()
        }
      },
    });
  } catch (error) {
    console.error("Error creating travel:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


// exports.searchRides = async (req, res) => {
//   try {
//     const { leavingLocation, goingLocation, date, travelMode, phoneNumber } = req.query;
//     console.log("Received query:", { leavingLocation, goingLocation, date, travelMode, phoneNumber });

//     if (!leavingLocation || !goingLocation || !date) {
//       return res.status(400).json({ message: "Leaving location, going location, and date are required" });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(date)) {
//       return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
//     }

//     const searchDate = new Date(date);
//     const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
//     const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

//     const { distance } = await mapservice.getDistanceTime(leavingLocation, goingLocation);
//     if (!distance || !distance.text) {
//       return res.status(400).json({ message: "Unable to calculate distance. Please check the locations." });
//     }

//     const distanceText = distance.text;
//     const distanceValue = parseFloat(distanceText.replace(/[^\d.]/g, ""));
//     console.log("Distance value:", distanceValue);

//     const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
//     const goingCoords = await mapservice.getAddressCoordinate(goingLocation);

//     if (!leavingCoords || !goingCoords) {
//       return res.status(400).json({ message: "Invalid location input. Please enter a valid city or address." });
//     }

//     console.log("Leaving Coordinates:", leavingCoords);
//     console.log("Going Coordinates:", goingCoords);

//     const query = {
//       "LeavingCoordinates.ltd": leavingCoords.ltd,
//       "LeavingCoordinates.lng": leavingCoords.lng,
//       "GoingCoordinates.ltd": goingCoords.ltd,
//       "GoingCoordinates.lng": goingCoords.lng,
//       travelDate: { $gte: startOfDay, $lt: endOfDay },
//       phoneNumber: { $ne: phoneNumber }
//     };

//     if (travelMode && travelMode.trim() !== "") {
//       query.travelMode = travelMode;
//     }

//     const availableRides = await Traveldetails.find(query);

//     const allTravelModes = ["train", "airplane", "car"];
//     let availableTravelModes = travelMode && travelMode.trim() !== "" ? [travelMode] : allTravelModes;

//     const estimatedFares = availableTravelModes.reduce((acc, mode) => {
//       const faree = fare.calculateFarewithoutweight(distanceValue, mode);
//       if (typeof faree !== "undefined") {
//         acc[mode] = faree;
//       }
//       return acc;
//     }, {});

//     if (Object.keys(estimatedFares).length === 0) {
//       return res.status(500).json({ message: "Error calculating estimated fares." });
//     }

//     if (!availableRides.length) {
//       return res.status(200).json({ availableRides: [], estimatedFares, availableTravelModes });
//     }

//     const ridesWithProfile = await Promise.all(
//       availableRides.map(async (ride) => {
//         const userProfile = await userprofiles.findOne(
//           { phoneNumber: ride.phoneNumber },
//           { profilePicture: 1, totalrating: 1, averageRating: 1 }
//         ).lean();
//         return {
//           ...ride.toObject(),
//           profilePicture: userProfile?.profilePicture || null,
//           rating: userProfile?.totalrating || null,
//           averageRating: userProfile?.averageRating || 6
//         };
//       })
//     );

//     if (!travelMode || travelMode.trim() === "") {
//       const foundTravelModes = [...new Set(availableRides.map(ride => ride.travelMode))];
//       availableTravelModes = allTravelModes.filter(mode => foundTravelModes.includes(mode) || estimatedFares[mode]);
//     }

//     res.status(200).json({
//       availableRides: ridesWithProfile,
//       estimatedFares,
//       availableTravelModes
//     });
//   } catch (error) {
//     console.error("Error in searchRides:", error.stack);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };

exports.searchRides = async (req, res) => {
  try {
    const { leavingLocation, goingLocation, date, travelMode: originalTravelMode, phoneNumber, userTimezone } = req.query;
    console.log("Received search query:", { leavingLocation, goingLocation, date, travelMode: originalTravelMode, userTimezone });
    
    // Set default timezone if not provided
    const timezone = userTimezone || 'Asia/Kolkata';
    
    // Handle travel mode mapping
    let travelMode = originalTravelMode;
    console.log("Original travel mode:", originalTravelMode);
    
    // Map car to roadways for consistency
    if (travelMode === "car") {
      travelMode = "roadways";
    }
    if (!travelMode) {
      travelMode = "roadways"; // Default to roadways instead of car
    }
    console.log("Processed travel mode:", travelMode);
    if (!leavingLocation || !goingLocation || !date) {
      return res.status(400).json({ message: "Leaving location, going location, and date are required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    // Handle timezone-aware date parsing for search
    let searchDate;
    try {
      // Create moment object in user's timezone
      searchDate = moment.tz(date, timezone);
      
      if (!searchDate.isValid()) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
      }
      
      console.log("Timezone-aware search date parsing:", {
        originalDate: date,
        userTimezone: timezone,
        parsedDate: searchDate.format(),
        parsedDateISO: searchDate.utc().toISOString()
      });
    } catch (error) {
      console.error("Date parsing error:", error);
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    // Convert the input date to start and end of day in UTC
    // For proper timezone handling, we need to ensure we get the correct start and end of day
    const startOfDay = moment.tz(date, timezone).startOf('day').utc().toDate();
    
    // Calculate end of day properly to cover the full day in user's timezone
    // We need to add 1 day to the start and subtract 1 millisecond to get the end of the current day
    const endOfDay = moment.tz(date, timezone).add(1, 'day').startOf('day').subtract(1, 'millisecond').utc().toDate();

    // Create normalized date for travel search (since travelDate is stored as YYYY-MM-DD string)
    const normalizedDate = moment.tz(date, timezone).format('YYYY-MM-DD');

    console.log("Date range for search:", { 
      startOfDay: startOfDay.toISOString(), 
      endOfDay: endOfDay.toISOString(),
      startOfDayLocal: moment.utc(startOfDay).tz(timezone).format('YYYY-MM-DD HH:mm:ss'),
      endOfDayLocal: moment.utc(endOfDay).tz(timezone).format('YYYY-MM-DD HH:mm:ss'),
      normalizedDate: normalizedDate
    });

    const { distance } = await mapservice.getDistanceTime(leavingLocation, goingLocation);
    if (!distance || !distance.text) {
      return res.status(400).json({ message: "Unable to calculate distance. Please check the locations." });
    }

    const distanceText = distance.text;
    console.log("Raw distance text:", distanceText);
    console.log("Distance object:", distance);
    
    const distanceValue = parseFloat(distanceText.replace(/[^\d.]/g, ""));
    console.log("Distance value:", distanceValue);
    console.log("Distance value type:", typeof distanceValue);
    console.log("Distance value is NaN:", isNaN(distanceValue));

    // Validate distance value
    if (isNaN(distanceValue) || distanceValue <= 0) {
      console.log("Invalid distance value calculated:", distanceValue);
      return res.status(400).json({ message: "Unable to calculate valid distance. Please check the locations." });
    }

    const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
    const goingCoords = await mapservice.getAddressCoordinate(goingLocation);
    console.log(leavingCoords, goingCoords)
    if (!leavingCoords || !goingCoords) {
      return res.status(400).json({ message: "Invalid location input. Please enter a valid city or address." });
    }

    // console.log("Search coordinates:", {
    //   leaving: leavingCoords,
    //   going: goingCoords
    // });

    // Increase search radius for better matching
    const radiusInMeters = 10 * 1000; // 10km for initial bounding box

    // Get bounding boxes for both locations
    const leavingBoundingBox = getBoundingBox(
      { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
      radiusInMeters
    );

    const goingBoundingBox = getBoundingBox(
      { latitude: goingCoords.ltd, longitude: goingCoords.lng },
      radiusInMeters
    );

    // console.log("Search bounding boxes:", {
    //   leaving: leavingBoundingBox,
    //   going: goingBoundingBox
    // });

    // First try exact coordinate matching
    // Since travelDate is now stored as YYYY-MM-DD string, we need to search by the normalized date
    const exactQuery = {
      "LeavingCoordinates.ltd": leavingCoords.ltd,
      "LeavingCoordinates.lng": leavingCoords.lng,
      "GoingCoordinates.ltd": goingCoords.ltd,
      "GoingCoordinates.lng": goingCoords.lng,
      travelDate: normalizedDate,
      phoneNumber: { $ne: phoneNumber }
    };

    let exactRides = await Traveldetails.find(exactQuery).lean();
    console.log("Found rides with exact coordinate matching:", exactRides.length);

    // If no exact matches, try 10km radius matching
    if (exactRides.length === 0) {
      const radiusQuery = {
        travelDate: normalizedDate,
        phoneNumber: { $ne: phoneNumber }
      };

      const allRidesForRadius = await Traveldetails.find(radiusQuery).lean();
      
      exactRides = allRidesForRadius.filter(ride => {
        const leavingDistance = geolib.getDistance(
          { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
          { latitude: ride.LeavingCoordinates.ltd, longitude: ride.LeavingCoordinates.lng }
        );

        const goingDistance = geolib.getDistance(
          { latitude: goingCoords.ltd, longitude: goingCoords.lng },
          { latitude: ride.GoingCoordinates.ltd, longitude: ride.GoingCoordinates.lng }
        );

        const radiusInMeters = 10 * 1000; // 10km
        return leavingDistance <= radiusInMeters && goingDistance <= radiusInMeters;
      });
      
      console.log("Found rides with 10km radius matching:", exactRides.length);
    }

    // If no exact matches, try bounding box approach
    const baseQuery = {
      "LeavingCoordinates.ltd": { $gte: leavingBoundingBox.minLat, $lte: leavingBoundingBox.maxLat },
      "LeavingCoordinates.lng": { $gte: leavingBoundingBox.minLng, $lte: leavingBoundingBox.maxLng },
      "GoingCoordinates.ltd": { $gte: goingBoundingBox.minLat, $lte: goingBoundingBox.maxLat },
      "GoingCoordinates.lng": { $gte: goingBoundingBox.minLng, $lte: goingBoundingBox.maxLng },
      travelDate: normalizedDate,
      phoneNumber: { $ne: phoneNumber }
    };

    // Use exact rides if found, otherwise use bounding box approach
    let availableRides = exactRides;
    
    if (exactRides.length === 0) {
      // More flexible travel mode query
      let query = baseQuery;
      
      if (travelMode && travelMode.trim() !== "") {
        const searchTravelMode = travelMode.toLowerCase().trim();
        
        // Create flexible travel mode conditions
        const travelModeConditions = [
          { travelMode: searchTravelMode },
          { vehicleType: searchTravelMode }
        ];
        
        // Add mappings for car/roadways
        if (searchTravelMode === "roadways") {
          travelModeConditions.push({ travelMode: "car" });
          travelModeConditions.push({ vehicleType: "car" });
        } else if (searchTravelMode === "car") {
          travelModeConditions.push({ travelMode: "roadways" });
          travelModeConditions.push({ vehicleType: "roadways" });
        }
        
        query = { 
          ...baseQuery, 
          $or: travelModeConditions
        };
      }

      console.log("Database query for travel mode:", travelMode);
      console.log("Full query:", JSON.stringify(query, null, 2));
      availableRides = await Traveldetails.find(query).lean();
      console.log("Rides found with travel mode filter:", availableRides.length);
    } else {
      // Filter exact rides by travel mode if specified
      if (travelMode && travelMode.trim() !== "") {
        console.log("Filtering exact rides by travel mode:", travelMode);
        const searchTravelMode = travelMode.toLowerCase().trim();
        
        availableRides = exactRides.filter(ride => {
          const rideTravelMode = ride.travelMode ? ride.travelMode.toLowerCase().trim() : "";
          const rideVehicleType = ride.vehicleType ? ride.vehicleType.toLowerCase().trim() : "";
          
          return rideTravelMode === searchTravelMode ||
                 rideVehicleType === searchTravelMode ||
                 (searchTravelMode === "roadways" && (rideTravelMode === "car" || rideVehicleType === "car")) ||
                 (searchTravelMode === "car" && (rideTravelMode === "roadways" || rideVehicleType === "roadways"));
        });
        console.log("Exact rides after travel mode filtering:", availableRides.length);
      }
    }

    // Note: Removed the "booked rides" filtering logic since rides can now accept multiple consignments
    // The multi-consignment acceptance is handled in the booking process itself
    console.log("Available rides after coordinate/travel mode filtering:", availableRides.length);

    // Filter out rides with certain statuses (but allow Accepted rides to accept more consignments)
    availableRides = availableRides.filter(ride => 
      !ride.status || !["Completed", "Cancelled"].includes(ride.status)
    );
    console.log("Available rides after filtering by status:", availableRides.length);
    console.log("Found rides before distance filtering:", availableRides.length);
    
    // Debug: Check all rides for the date without location filtering
    const allRidesForDate = await Traveldetails.find({
      travelDate: normalizedDate,
      phoneNumber: { $ne: phoneNumber }
    }).lean();
    console.log("Total rides for the date (without location filter):", allRidesForDate.length);
    
    if (allRidesForDate.length > 0) {
      console.log("Sample rides for the date:", allRidesForDate.slice(0, 3).map(ride => ({
        rideId: ride.rideId,
        leavingLocation: ride.Leavinglocation,
        goingLocation: ride.Goinglocation,
        leavingCoords: ride.LeavingCoordinates,
        goingCoords: ride.GoingCoordinates,
        travelMode: ride.travelMode,
        vehicleType: ride.vehicleType
      })));
      
      // Debug: Show all unique travel modes in the database for this date
      const uniqueTravelModes = [...new Set(allRidesForDate.map(ride => ride.travelMode).filter(Boolean))];
      const uniqueVehicleTypes = [...new Set(allRidesForDate.map(ride => ride.vehicleType).filter(Boolean))];
      console.log("Unique travel modes in database for this date:", uniqueTravelModes);
      console.log("Unique vehicle types in database for this date:", uniqueVehicleTypes);
    }

    // Apply precise distance filtering (ALWAYS apply distance filtering)
    let filteredRides = availableRides.filter(ride => {
      const leavingDistance = geolib.getDistance(
        { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
        { latitude: ride.LeavingCoordinates.ltd, longitude: ride.LeavingCoordinates.lng }
      );

      const goingDistance = geolib.getDistance(
        { latitude: goingCoords.ltd, longitude: goingCoords.lng },
        { latitude: ride.GoingCoordinates.ltd, longitude: ride.GoingCoordinates.lng }
      );

      console.log("Distance check for ride:", {
        rideId: ride._id,
        leavingDistance: Math.round(leavingDistance / 1000) + "km",
        goingDistance: Math.round(goingDistance / 1000) + "km",
        leavingCoords: ride.LeavingCoordinates,
        goingCoords: ride.GoingCoordinates,
        searchLeavingCoords: leavingCoords,
        searchGoingCoords: goingCoords
      });

      // Use a reasonable radius for precise matching (10km)
      const preciseRadiusInMeters = 10 * 1000; // 10km
      const distanceMatch = leavingDistance <= preciseRadiusInMeters && goingDistance <= preciseRadiusInMeters;
      
      // Add direction validation - ensure ride direction matches search direction
      const normalizeLocation = (location) => {
        return location.toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters except spaces
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim();
      };
      
      const normalizedSearchLeaving = normalizeLocation(leavingLocation);
      const normalizedSearchGoing = normalizeLocation(goingLocation);
      const normalizedRideLeaving = normalizeLocation(ride.Leavinglocation);
      const normalizedRideGoing = normalizeLocation(ride.Goinglocation);
      
      // Extract key location words (cities, states, etc.)
      const extractKeyWords = (location) => {
        const words = location.split(' ').filter(word => word.length > 2);
        return words;
      };
      
      const searchLeavingWords = extractKeyWords(normalizedSearchLeaving);
      const searchGoingWords = extractKeyWords(normalizedSearchGoing);
      const rideLeavingWords = extractKeyWords(normalizedRideLeaving);
      const rideGoingWords = extractKeyWords(normalizedRideGoing);
      
      // Check for word overlap (more flexible matching)
      const hasWordOverlap = (words1, words2) => {
        return words1.some(word1 => 
          words2.some(word2 => 
            word1.includes(word2) || word2.includes(word1)
          )
        );
      };
      
      // Direction validation: ride starting location should match search leaving location
      // AND ride going location should match search going location
      const startingLocationMatch = hasWordOverlap(searchLeavingWords, rideLeavingWords) ||
                                  normalizedRideLeaving.includes(normalizedSearchLeaving) ||
                                  normalizedSearchLeaving.includes(normalizedRideLeaving);
      
      const goingLocationMatch = hasWordOverlap(searchGoingWords, rideGoingWords) ||
                               normalizedRideGoing.includes(normalizedSearchGoing) ||
                               normalizedSearchGoing.includes(normalizedRideGoing);
      
      const directionMatch = startingLocationMatch && goingLocationMatch;
      
      console.log("Distance and direction check for ride:", {
        rideId: ride._id,
        rideDirection: `${ride.Leavinglocation} -> ${ride.Goinglocation}`,
        searchDirection: `${leavingLocation} -> ${goingLocation}`,
        leavingDistance: Math.round(leavingDistance / 1000) + "km",
        goingDistance: Math.round(goingDistance / 1000) + "km",
        distanceMatch,
        directionMatch,
        normalizedRideLeaving,
        normalizedRideGoing,
        normalizedSearchLeaving,
        normalizedSearchGoing,
        rideLeavingWords,
        rideGoingWords,
        searchLeavingWords,
        searchGoingWords,
        startingLocationMatch,
        goingLocationMatch,
        leavingCoords: ride.LeavingCoordinates,
        goingCoords: ride.GoingCoordinates,
        searchLeavingCoords: leavingCoords,
        searchGoingCoords: goingCoords
      });
      
      return distanceMatch && directionMatch;
    });
    
    console.log("Rides after distance filtering:", filteredRides.length);

    console.log("Available rides after filtering:", filteredRides.length);

    // Only try location name matching if coordinate matching found no results
    if (filteredRides.length === 0) {
      console.log("No rides found with coordinate matching, trying location name matching as fallback...");
      
      const alternativeRides = allRidesForDate.filter(ride => {
        // First apply distance filtering
        const leavingDistance = geolib.getDistance(
          { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
          { latitude: ride.LeavingCoordinates.ltd, longitude: ride.LeavingCoordinates.lng }
        );

        const goingDistance = geolib.getDistance(
          { latitude: goingCoords.ltd, longitude: goingCoords.lng },
          { latitude: ride.GoingCoordinates.ltd, longitude: ride.GoingCoordinates.lng }
        );

        // Use a reasonable radius for precise matching (10km)
        const preciseRadiusInMeters = 10 * 1000; // 10km
        const distanceMatch = leavingDistance <= preciseRadiusInMeters && goingDistance <= preciseRadiusInMeters;
        
        // First check travel mode if specified
        if (travelMode && travelMode.trim() !== "") {
          // More flexible travel mode matching
          const rideTravelMode = ride.travelMode ? ride.travelMode.toLowerCase().trim() : "";
          const rideVehicleType = ride.vehicleType ? ride.vehicleType.toLowerCase().trim() : "";
          const searchTravelMode = travelMode.toLowerCase().trim();
          
          // Check for exact matches and mappings
          const travelModeMatch = 
            rideTravelMode === searchTravelMode ||
            rideVehicleType === searchTravelMode ||
            (searchTravelMode === "roadways" && (rideTravelMode === "car" || rideVehicleType === "car")) ||
            (searchTravelMode === "car" && (rideTravelMode === "roadways" || rideVehicleType === "roadways"));
          
          console.log("Travel mode matching:", {
            rideId: ride.rideId,
            rideTravelMode,
            rideVehicleType,
            searchTravelMode,
            travelModeMatch
          });
          
          if (!travelModeMatch) {
            return false;
          }
        }
        
        // Clean and normalize location strings for better matching
        const normalizeLocation = (location) => {
          return location.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters except spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();
        };
        
        const normalizedSearchLeaving = normalizeLocation(leavingLocation);
        const normalizedSearchGoing = normalizeLocation(goingLocation);
        const normalizedRideLeaving = normalizeLocation(ride.Leavinglocation);
        const normalizedRideGoing = normalizeLocation(ride.Goinglocation);
        
        // Extract key location words (cities, states, etc.)
        const extractKeyWords = (location) => {
          const words = location.split(' ').filter(word => word.length > 2);
          return words;
        };
        
        const searchLeavingWords = extractKeyWords(normalizedSearchLeaving);
        const searchGoingWords = extractKeyWords(normalizedSearchGoing);
        const rideLeavingWords = extractKeyWords(normalizedRideLeaving);
        const rideGoingWords = extractKeyWords(normalizedRideGoing);
        
        // Check for word overlap (more flexible matching)
        const hasWordOverlap = (words1, words2) => {
          return words1.some(word1 => 
            words2.some(word2 => 
              word1.includes(word2) || word2.includes(word1)
            )
          );
        };
        
        const leavingMatch = hasWordOverlap(searchLeavingWords, rideLeavingWords) ||
                         normalizedRideLeaving.includes(normalizedSearchLeaving) ||
                         normalizedSearchLeaving.includes(normalizedRideLeaving);
        
        const goingMatch = hasWordOverlap(searchGoingWords, rideGoingWords) ||
                        normalizedRideGoing.includes(normalizedSearchGoing) ||
                        normalizedSearchGoing.includes(normalizedRideGoing);
        
        console.log("Alternative matching for ride:", {
          rideId: ride.rideId,
          rideLeaving: ride.Leavinglocation,
          rideGoing: ride.Goinglocation,
          searchLeaving: leavingLocation,
          searchGoing: goingLocation,
          leavingDistance: Math.round(leavingDistance / 1000) + "km",
          goingDistance: Math.round(goingDistance / 1000) + "km",
          distanceMatch,
          rideTravelMode: ride.travelMode,
          rideVehicleType: ride.vehicleType,
          searchTravelMode: travelMode,
          normalizedRideLeaving,
          normalizedRideGoing,
          normalizedSearchLeaving,
          normalizedSearchGoing,
          rideLeavingWords,
          rideGoingWords,
          searchLeavingWords,
          searchGoingWords,
          leavingMatch,
          goingMatch
        });
        
        return distanceMatch && leavingMatch && goingMatch;
      });
      
      if (alternativeRides.length > 0) {
        console.log("Found rides using location name matching (fallback):", alternativeRides.length);
        
        // Note: Removed the "booked rides" filtering logic since rides can now accept multiple consignments
        // The multi-consignment acceptance is handled in the booking process itself
        const filteredAlternativeRides = alternativeRides;
        
        // Also filter out rides with certain statuses (but allow Accepted rides to accept more consignments)
        const finalAlternativeRides = filteredAlternativeRides.filter(ride => 
          !ride.status || !["Completed", "Cancelled"].includes(ride.status)
        );
        
        console.log("Alternative rides after filtering accepted ones:", finalAlternativeRides.length);
        
        if (finalAlternativeRides.length > 0) {
          filteredRides = finalAlternativeRides;
        } else {
          console.log("No rides found with any matching method after filtering");
          return res.status(200).json({
            message: "No rides found",
            searchParams: {
              leavingLocation,
              goingLocation,
              date,
              travelMode,
              leavingCoords,
              goingCoords
            }
          });
        }
      } else {
        console.log("No rides found with any matching method");
        return res.status(200).json({
          message: "No rides found",
          searchParams: {
            leavingLocation,
            goingLocation,
            date,
            travelMode,
            leavingCoords,
            goingCoords
          }
        });
      }
    } else {
      console.log("Using coordinate matching results");
    }

    const ridesWithProfile = await Promise.all(
      filteredRides.map(async (ride) => {
        const userProfile = await userprofiles.findOne(
          { phoneNumber: ride.phoneNumber },
          { profilePicture: 1, totalrating: 1, averageRating: 1 }
        ).lean();
        return {
          ...ride,
          profilePicture: userProfile?.profilePicture || null,
          rating: userProfile?.totalrating || 0,
          averageRating: userProfile?.averageRating || 0
        };
      })
    );
    console.log("distance value: ", distanceValue)
    // Convert roadways to car for fare calculation
    const fareTravelMode = travelMode === "roadways" ? "car" : (travelMode || "car");
    console.log("Calculating fare with:", { distanceValue, fareTravelMode });
    
    let estimatedFare;
    try {
      estimatedFare = await fare.calculateFarewithoutweight(distanceValue, fareTravelMode);
      console.log("Fare calculation result:", estimatedFare);
    } catch (error) {
      console.error("Error calculating fare:", error);
      estimatedFare = { error: "Failed to calculate fare" };
    }

    if (estimatedFare === undefined || estimatedFare === null) {
      return res.status(500).json({ message: "Error calculating estimated fare." });
    }
    console.log("Estimated fare:", estimatedFare);

    // Search for user's consignments to calculate correct prices
    let userConsignments = [];
    let calculatedPrices = [];
    
    if (phoneNumber) {
      try {
        // Search for consignments with location matching
        const locationQuery = {
          phoneNumber: phoneNumber,
          dateOfSending: { $gte: startOfDay, $lt: endOfDay },
          status: { $nin: ["Accepted", "Rejected", "Expired", "Completed"] } // Only get valid consignments
        };

        // Add location filtering based on coordinates
        if (leavingCoords && goingCoords) {
          // Define radius for location matching (10km)
          const radiusInMeters = 10 * 1000;
          
          // Helper function to get bounding box
          const getBoundingBox = (center, radius) => {
            const latDelta = radius / 111320; // 1 degree latitude = 111.32 km
            const lngDelta = radius / (111320 * Math.cos(center.latitude * Math.PI / 180));
            
            return {
              minLat: center.latitude - latDelta,
              maxLat: center.latitude + latDelta,
              minLng: center.longitude - lngDelta,
              maxLng: center.longitude + lngDelta
            };
          };

          // Get bounding boxes for search locations
          const leavingBoundingBox = getBoundingBox(
            { latitude: leavingCoords.ltd, longitude: leavingCoords.lng },
            radiusInMeters
          );

          const goingBoundingBox = getBoundingBox(
            { latitude: goingCoords.ltd, longitude: goingCoords.lng },
            radiusInMeters
          );

          // Add coordinate-based location filtering
          locationQuery.$and = [
            {
              "LeavingCoordinates.latitude": { $gte: leavingBoundingBox.minLat, $lte: leavingBoundingBox.maxLat },
              "LeavingCoordinates.longitude": { $gte: leavingBoundingBox.minLng, $lte: leavingBoundingBox.maxLng }
            },
            {
              "GoingCoordinates.latitude": { $gte: goingBoundingBox.minLat, $lte: goingBoundingBox.maxLat },
              "GoingCoordinates.longitude": { $gte: goingBoundingBox.minLng, $lte: goingBoundingBox.maxLng }
            }
          ];

          console.log("Location filtering applied:", {
            leavingLocation,
            goingLocation,
            leavingCoords,
            goingCoords,
            leavingBoundingBox,
            goingBoundingBox
          });
        }

        userConsignments = await consignmentData.find(locationQuery).sort({ createdAt: -1 });

        console.log("Found consignments with location filtering:", userConsignments.length);

        // If no consignments found with coordinate matching, try location name matching as fallback
        if (userConsignments.length === 0 && leavingLocation && goingLocation) {
          console.log("No consignments found with coordinate matching, trying location name matching...");
          
          const nameLocationQuery = {
            phoneNumber: phoneNumber,
            dateOfSending: { $gte: startOfDay, $lt: endOfDay },
            status: { $nin: ["Accepted", "Rejected", "Expired", "Completed"] }
          };

          // Normalize location names for comparison
          const normalizeLocation = (location) => {
            return location.toLowerCase().replace(/[^\w\s]/g, '').trim();
          };

          const normalizedLeavingLocation = normalizeLocation(leavingLocation);
          const normalizedGoingLocation = normalizeLocation(goingLocation);

          // Try to find consignments with similar location names
          const fallbackConsignments = await consignmentData.find(nameLocationQuery).sort({ createdAt: -1 });
          
          userConsignments = fallbackConsignments.filter(consignment => {
            const consignmentLeaving = normalizeLocation(consignment.startinglocation || '');
            const consignmentGoing = normalizeLocation(consignment.goinglocation || '');
            
            const leavingMatch = consignmentLeaving.includes(normalizedLeavingLocation) || 
                                normalizedLeavingLocation.includes(consignmentLeaving);
            const goingMatch = consignmentGoing.includes(normalizedGoingLocation) || 
                              normalizedGoingLocation.includes(consignmentGoing);
            
            return leavingMatch && goingMatch;
          });

          console.log("Found consignments with location name matching:", userConsignments.length);
        }

        for(let i = 0; i < userConsignments.length; i++){
        console.log("Found user consignments:", userConsignments[i]);
        }
        if (userConsignments.length > 0) {
          // Calculate prices for each consignment
          calculatedPrices = await Promise.all(userConsignments.map(async (consignment) => {
            try {
              console.log("Processing consignment:", {
                consignmentId: consignment?.consignmentId,
                weight: consignment?.weight,
                dimensions: consignment?.dimensions,
                distance: consignment?.distance,
                leavingCoordinates: consignment?.LeavingCoordinates,
                goingCoordinates: consignment?.GoingCoordinates
              });

              // Extract weight and distance from consignment
              const weight = parseFloat(consignment.weight?.toString().replace(/[^\d.]/g, ""));
              const consignmentDistance = parseFloat(consignment.distance?.toString().replace(/[^\d.]/g, ""));

              if (!isNaN(weight) && !isNaN(consignmentDistance)) {
                // Extract dimensions if available
                const dimensions = consignment.dimensions;
                const length = dimensions?.length ? parseFloat(dimensions.length) : null;
                const height = dimensions?.height ? parseFloat(dimensions.height) : null;
                const breadth = dimensions?.breadth ? parseFloat(dimensions.breadth) : null;

                // Calculate fare using the fare service with consignment data
                const calculatedPrice = await fare.calculateFare(
                  weight, 
                  consignmentDistance, 
                  fareTravelMode, 
                  length, 
                  height, 
                  breadth
                );

                console.log("Calculated price from consignment:", {
                  consignmentId: consignment.consignmentId,
                  weight,
                  distance: consignmentDistance,
                  travelMode: fareTravelMode,
                  dimensions: { length, height, breadth },
                  calculatedPrice
                });

                return {
                  consignmentId: consignment.consignmentId,
                  weight: consignment.weight,
                  dimensions: consignment.dimensions,
                  distance: consignment.distance,
                  dateOfSending: consignment.dateOfSending,
                  calculatedPrice,
                  status: consignment.status
                };
              } else {
                console.log("Invalid weight or distance in consignment, using estimated fare");
                return {
                  consignmentId: consignment.consignmentId,
                  weight: consignment.weight,
                  dimensions: consignment.dimensions,
                  distance: consignment.distance,
                  dateOfSending: consignment.dateOfSending,
                  calculatedPrice: estimatedFare,
                  status: consignment.status,
                  priceError: "Invalid weight or distance"
                };
              }
            } catch (error) {
              console.error(`Error calculating price for consignment ${consignment.consignmentId}:`, error);
              return {
                consignmentId: consignment.consignmentId,
                weight: consignment.weight,
                dimensions: consignment.dimensions,
                distance: consignment.distance,
                dateOfSending: consignment.dateOfSending,
                calculatedPrice: estimatedFare,
                status: consignment.status,
                priceError: error.message
              };
            }
          }));

          console.log("Calculated prices for all consignments:", calculatedPrices.length);
        } else {
          console.log("No valid consignments found for user on the given date, using estimated fare");
          calculatedPrices = [{
            consignmentId: null,
            weight: null,
            dimensions: null,
            distance: null,
            dateOfSending: null,
            calculatedPrice: estimatedFare,
            status: null,
            priceError: "No valid consignments found"
          }];
        }
      } catch (error) {
        console.error("Error calculating prices from consignments:", error);
        calculatedPrices = [{
          consignmentId: null,
          weight: null,
          dimensions: null,
          distance: null,
          dateOfSending: null,
          calculatedPrice: estimatedFare,
          status: null,
          priceError: error.message
        }];
      }
    } else {
      calculatedPrices = [{
        consignmentId: null,
        weight: null,
        dimensions: null,
        distance: null,
        dateOfSending: null,
        calculatedPrice: estimatedFare,
        status: null,
        priceError: "No phone number provided"
      }];
    }

    // Debug: Log final results
    console.log("Final results - Number of rides found:", ridesWithProfile.length);
    if (ridesWithProfile.length > 0) {
      console.log("Sample final rides:", ridesWithProfile.slice(0, 3).map(ride => ({
        rideId: ride.rideId,
        leavingLocation: ride.Leavinglocation,
        goingLocation: ride.Goinglocation,
        travelMode: ride.travelMode,
        vehicleType: ride.vehicleType
      })));
    }
    
    res.status(200).json({
      availableRides: ridesWithProfile,
      estimatedFare,
      calculatedPrices,
      userConsignments: userConsignments.map(consignment => ({
        consignmentId: consignment.consignmentId,
        weight: consignment.weight,
        dimensions: consignment.dimensions,
        distance: consignment.distance,
        dateOfSending: consignment.dateOfSending,
        status: consignment.status
      })),
      searchParams: {
        leavingLocation,
        goingLocation,
        date,
        travelMode,
        leavingCoords,
        goingCoords
      }
    });
  } catch (error) {
    console.error("Error in searchRides:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// exports.searchRides = async (req, res) => {
//   try {
//     const { leavingLocation, goingLocation, date, travelMode, phoneNumber } = req.query;
//     console.log("Received query:", { leavingLocation, goingLocation, date, travelMode, phoneNumber });

//     if (!leavingLocation || !goingLocation || !date) {
//       return res.status(400).json({ message: "Leaving location, going location, and date are required" });
//     }

//     const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
//     if (!dateRegex.test(date)) {
//       return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
//     }

//     const searchDate = new Date(date);
//     const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
//     const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

//     const { distance } = await mapservice.getDistanceTime(leavingLocation, goingLocation);
//     if (!distance || !distance.text) {
//       return res.status(400).json({ message: "Unable to calculate distance. Please check the locations." });
//     }

//     const distanceText = distance.text;
//     const distanceValue = parseFloat(distanceText.replace(/[^\d.]/g, ""));
//     console.log("Distance value:", distanceValue);

//     const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
//     const goingCoords = await mapservice.getAddressCoordinate(goingLocation);

//     if (!leavingCoords || !goingCoords) {
//       return res.status(400).json({ message: "Invalid location input. Please enter a valid city or address." });
//     }

//     console.log("Leaving Coordinates:", leavingCoords);
//     console.log("Going Coordinates:", goingCoords);

//     const query = {
//       $or: [
//         {
//           "LeavingCoordinates.ltd": leavingCoords.ltd,
//           "LeavingCoordinates.lng": leavingCoords.lng,
//           "GoingCoordinates.ltd": goingCoords.ltd,
//           "GoingCoordinates.lng": goingCoords.lng
//         },
//         {
//           intermediateStops: {
//             $elemMatch: {
//               "ltd": { $in: [leavingCoords.ltd, goingCoords.ltd] },
//               "lng": { $in: [leavingCoords.lng, goingCoords.lng] }
//             }
//           }
//         }
//       ],
//       travelDate: { $gte: startOfDay, $lt: endOfDay },
//       phoneNumber: { $ne: phoneNumber }
//     };

//     if (travelMode && travelMode.trim() !== "") {
//       query.travelMode = travelMode;
//     }

//     const availableRides = await Traveldetails.find(query);

//     const allTravelModes = ["train", "airplane", "car"];
//     let availableTravelModes = travelMode && travelMode.trim() !== "" ? [travelMode] : allTravelModes;

//     const estimatedFares = availableTravelModes.reduce((acc, mode) => {
//       const faree = fare.calculateFarewithoutweight(distanceValue, mode);
//       if (typeof faree !== "undefined") {
//         acc[mode] = faree;
//       }
//       return acc;
//     }, {});

//     if (Object.keys(estimatedFares).length === 0) {
//       return res.status(500).json({ message: "Error calculating estimated fares." });
//     }

//     if (!availableRides.length) {
//       return res.status(200).json({ availableRides: [], estimatedFares, availableTravelModes });
//     }

//     const ridesWithProfile = await Promise.all(
//       availableRides.map(async (ride) => {
//         const userProfile = await userprofiles.findOne(
//           { phoneNumber: ride.phoneNumber },
//           { profilePicture: 1, totalrating: 1, averageRating: 1 }
//         ).lean();
//         return {
//           ...ride.toObject(),
//           profilePicture: userProfile?.profilePicture || null,
//           rating: userProfile?.totalrating || null,
//           averageRating: userProfile?.averageRating || 6
//         };
//       })
//     );

//     if (!travelMode || travelMode.trim() === "") {
//       const foundTravelModes = [...new Set(availableRides.map(ride => ride.travelMode))];
//       availableTravelModes = allTravelModes.filter(mode => foundTravelModes.includes(mode) || estimatedFares[mode]);
//     }

//     res.status(200).json({
//       availableRides: ridesWithProfile,
//       estimatedFares,
//       availableTravelModes
//     });
//   } catch (error) {
//     console.error("Error in searchRides:", error.stack);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };


module.exports.booking = async (req, res) => {
  const { phoneNumber, rideId, consignmentId, travelMode, calculatedPrice, weight, distance } = req.body;
  
  // Add detailed logging for debugging
  console.log("=== BOOKING REQUEST DEBUG ===");
  console.log("Received payload:", req.body);
  console.log("Consignment ID:", consignmentId);
  console.log("Travel Mode:", travelMode);
  console.log("Pre-calculated Price:", calculatedPrice);
  console.log("Weight:", weight);
  console.log("Distance:", distance);
  
  try {
    // Validate that required pricing data is present
    if (!calculatedPrice || !calculatedPrice.totalFare) {
      return res.status(400).json({ 
        message: "Pre-calculated pricing is required. Please ensure travel option is selected." 
      });
    }

    // Validate travel mode is present
    if (!travelMode) {
      return res.status(400).json({ 
        message: "Travel mode is required." 
      });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Check for consignment - use consignmentId if provided, otherwise fallback to current date logic
    let con;
    if (consignmentId) {
      con = await consignmentData.findOne({ consignmentId });
      if (!con) {
        return res.status(404).json({
          message: "Consignment not found with the provided ID."
        });
      }
    } else {
      // Fallback to current date logic
      con = await consignmentData
        .findOne({
          phoneNumber,
          createdAt: { $gte: now, $lte: endOfDay }
        })
        .sort({ createdAt: -1 })
        .exec();

      if (!con) {
        return res.status(404).json({
          message: "No consignment found for today. Please publish a consignment first."
        });
      }
    }

    // Check if consignment is already accepted by another traveler
    const existingRequest = await Request.findOne({
      consignmentId: con.consignmentId,
      status: "Accepted",
    });
    if (existingRequest) {
      return res.status(400).json({ message: "Consignment has already been accepted by another traveler." });
    }

    // Check if consignment status is already set to accepted/rejected/expired/completed
    if (con.status && ["Accepted", "Expired", "Completed"].includes(con.status)) {
      return res.status(400).json({ message: `Consignment is already ${con.status.toLowerCase()}.` });
    }

    const ride = await Traveldetails.findOne({ rideId });
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    // Check if ride status is completed or cancelled (but allow Accepted rides to accept more consignments)
    if (ride.status && ["Completed", "Cancelled"].includes(ride.status)) {
      return res.status(400).json({ message: `Ride is already ${ride.status.toLowerCase()}.` });
    }

    // Check if this specific consignment is already accepted by this ride
    const existingRideRequest = await Request.findOne({
      travelId: ride.travelId,
      consignmentId: con.consignmentId,
      status: "Accepted",
    });
    if (existingRideRequest) {
      return res.status(400).json({ message: "This consignment has already been accepted by this ride." });
    }

    const locationThreshold = 10.00;

    const isStartLocationClose =
      Math.abs(ride.LeavingCoordinates.ltd - con.LeavingCoordinates.latitude) <= locationThreshold &&
      Math.abs(ride.LeavingCoordinates.lng - con.LeavingCoordinates.longitude) <= locationThreshold;

    const isEndLocationClose =
      Math.abs(ride.GoingCoordinates.ltd - con.GoingCoordinates.latitude) <= locationThreshold &&
      Math.abs(ride.GoingCoordinates.lng - con.GoingCoordinates.longitude) <= locationThreshold;
    
    if (!isStartLocationClose || !isEndLocationClose) {
      return res.status(400).json({ message: "Ride locations do not sufficiently match consignment locations." });
    }

    const validModes = ["train", "airplane", "car", "roadways"];
    const rideTravelMode = ride.travelMode ? ride.travelMode : null;

    if (!validModes.includes(rideTravelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train', 'airplane', 'car', or 'roadways'." });
    }

    // Validate that the travel mode from frontend matches the ride's travel mode
    const frontendTravelMode = travelMode ? travelMode.toLowerCase().trim() : null;
    if (frontendTravelMode && frontendTravelMode !== rideTravelMode) {
      console.log("Travel mode mismatch - Frontend:", frontendTravelMode, "Ride:", rideTravelMode);
      return res.status(400).json({ 
        message: "Travel mode mismatch. The selected travel mode does not match the ride's travel mode." 
      });
    }

    // Use pre-calculated price from frontend if available
    let fareResult;
    if (calculatedPrice && calculatedPrice.totalFare) {
      // Use the pre-calculated price from frontend
      fareResult = calculatedPrice;
      console.log("Using pre-calculated price from frontend:", fareResult);
    } else {
      // Fallback to backend calculation only if frontend price is not available
      const conWeight = con.weight ? parseFloat(con.weight.toString().replace(/[^\d.]/g, "")) : NaN;
      const conDistance = con.distance ? parseFloat(con.distance.toString().replace(/[^\d.]/g, "")) : NaN;

      if (isNaN(conWeight) || isNaN(conDistance)) {
        return res.status(400).json({ message: "Invalid Weight or Distance! Please provide valid numbers." });
      }

      if (typeof fare.calculateFare !== "function") {
        return res.status(500).json({ message: "Fare calculation function is missing or not defined." });
      }

      fareResult = await fare.calculateFare(conWeight, conDistance, rideTravelMode);
      console.log("Using backend calculated price:", fareResult);
    }

    if (!fareResult) {
      return res.status(500).json({ message: "Error calculating fare amount." });
    }

    const expectedEarning = fareResult;
    const riderPhoneNumber = ride.phoneNumber;

    if (!riderPhoneNumber) {
      return res.status(400).json({ message: "Consignment owner phone number not found." });
    }

    const request = new Request({
      phoneNumber: riderPhoneNumber,
      travellername: ride.username,
      travelmode: ride.travelMode,
      travelId: ride.travelId,
      requestto: riderPhoneNumber,
      earning: expectedEarning,
      requestedby: con.phoneNumber,
      pickup: con.startinglocation,
      drop: con.goinglocation,
      consignmentId: con.consignmentId,
      weight: con.weight,
      dimension: con.dimensions,
    });

    await request.save();

    const notification = new Notification({
      phoneNumber: phoneNumber,
      requestto: riderPhoneNumber,
      requestedby: con.phoneNumber,
      consignmentId: con.consignmentId,
      earning: expectedEarning,
      travelId: ride.travelId,
      notificationType: "consignment_request"
    });
    await notification.save();

    const io = require('../../socket').getIO();
    const riderProfile = await userprofiles.findOne({ phoneNumber: riderPhoneNumber });
    if (riderProfile && riderProfile.socketId) {
      io.emit("sendnotification", {
        notification: {
          message: `New booking request sent to ${riderPhoneNumber}.`,
          travelId: request.travelId,
          consignmentId: con.consignmentId,
          notificationType: "booking",
          createdAt: new Date(),
          requestedby: riderPhoneNumber,
        },
      });

    }
    return res.status(200).json({
      message: "Success",
      booking: {
        phoneNumber,
        rideId,
        consignmentId: con.consignmentId,
        expectedEarning,
        travelId: ride.travelId,
        travelMode: ride.travelMode,
        vehicleType: ride.vehicleType,
        usedPreCalculatedPrice: !!(calculatedPrice && calculatedPrice.totalFare)
      },
    });

  } catch (error) {
    console.error("Booking error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
module.exports.getAllRides = async (req, res) => {
  const { phoneNumber } = req.params;

  try {

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }


    const user = await userprofiles.findOne({ phoneNumber });


    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    const rides = await Traveldetails.find({ phoneNumber: user.phoneNumber });


    if (!rides || rides.length === 0) {
      return res.status(404).json({ message: "No rides found for this phone number" });
    }


    return res.status(200).json({
      message: 'Rides history found',
      rides
    });

  } catch (error) {
    console.error('Error in getting all rides:', error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};







module.exports.consignmentcarryrequest = async (req, res) => {
  const { phoneNumber } = req.params;
  // const {consignmentId} = req.body.consignmentId;
  console.log(req.body)
  // Set today's start time (00:00:00)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0); // UTC 00:00

  console.log("📞 Phone Number:", phoneNumber);
  console.log("📅 Today Start (UTC):", todayStart.toISOString());

  try {
    // Fetch all requests for this phone number
    const allRequests = await Request.find({ phoneNumber }).sort({ createdAt: -1 });

    console.log("📦 All Requests (Full List):");
    allRequests.forEach((r, i) => {
      console.log(`${i + 1}. CreatedAt: ${r.createdAt} | ID: ${r._id}`);
    });

    // Filter only today's and future requests
    // const requests = allRequests.filter(req => new Date(req.createdAt) >= todayStart && req.status != "Expired" && req.status != "Rejected");
    const requests = allRequests.filter(req => new Date(req.createdAt) >= todayStart);

    const requestsWithDate = await Promise.all(requests.map(async (req) => {
      let dateOfSending = null;

      if (req.consignmentId) {
       const consignment = await consignmentData.findOne({ consignmentId: req.consignmentId }).select('dateOfSending');
        if (consignment) {
          dateOfSending = consignment.dateOfSending;
        }
      }

      return {
        ...req.toObject(),  // convert Mongoose document to plain object
        dateOfSending
      };
    }));


    console.log(`✅ Filtered Requests (Today + Future): ${requests.length}`);

    if (!requestsWithDate.length) {
      return res.status(404).json({ message: "No consignment carry requests available." });
    }
    console.log(
      "requests with date ", requestsWithDate
    )
    res.status(200).json({
      message: "Consignment carry requests",
      requests : requestsWithDate
    });

  } catch (error) {
    console.error("❌ Error in getting all consignment carry requests:", error.message);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};


exports.getTravelHistory = async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Fetch all travel history for the user
    const travels = await travelhistory.find({ phoneNumber }).sort({ createdAt: -1 }).lean();


    if (!travels.length) {
      return res.status(404).json({ message: "No travel history found" });
    }

    // Iterate through travels and count consignments for each travelId
    const travelsWithConsignments = await Promise.all(
      travels.map(async (travel) => {
        const consignmentCount = await Request.countDocuments({ travelId: travel.travelId });
        return { ...travel, consignmentCount };
      })
    );

    res.status(200).json({ travels: travelsWithConsignments });
  } catch (error) {
    console.error("Error fetching travel history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


module.exports.starttravel = async (req, res) => {
  const { travelId } = req.params;
  const { status } = req.body;

  try {

    if (!status) {
      return res.status(400).json({ message: "Missing status " });
    }
    if (!travelId) {
      return res.status(400).json({ message: "Missing  travel ID" });
    }




    const travel = await Traveldetails.findOne({ travelId });
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }


    // if (travel.status === "started") {
    //   return res.status(400).json({ message: "Travel already started" });
    // }


    const startTime = datetime.getCurrentDateTime();

    const updateResult = await travelhistory.updateOne(
      { travelId },
      { $set: { status: "started", startedat: startTime } }
    );
    const updateResult1 = await Traveldetails.updateOne(
      { travelId },
      { $set: { status: "started", startedat: startTime } }
    );


    if (updateResult.modifiedCount === 0 && updateResult1.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to update travel status" });
    }


    return res.status(200).json({
      message: "Travel started successfully",
      startTime,

    });

  } catch (error) {
    console.error("❌ Error starting travel:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};
module.exports.endtravel = async (req, res) => {

  const { travelId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }
  try {
    // const user = await User.findOne({ phoneNumber });
    // if (!user) {
    //   return res.status(404).json({ message: "User not found" });
    // }
    const travel = await Traveldetails.findOne({ travelId });
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }
    const endTime = datetime.getCurrentDateTime();

    const updateResult = await Traveldetails.updateOne(
      { travelId },
      {
        $set: {
          status: "completed",
          endedat: endTime
        }
      }
    );
    const updateResult1 = await travelhistory.updateOne(
      { travelId },
      { $set: { status: "ENDED", startedat: endTime } }
    );

    console.log("Update result:", updateResult);
    console.log("updated1:", updateResult1)

    if (updateResult.modifiedCount === 0 && updateResult1.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to update travel status" });
    }

    return res.status(200).json({
      message: "Travel ended successfully",
      endTime
    });
  }
  catch (error) {
    console.error("Error starting travel:", error);
  }


};


module.exports.traveldetailsusingtravelid = async (req, res) => {
  const { travelId } = req.params;
  try {
    const travel = await Traveldetails.findOne({ travelId });
    if (!travel) {
      return res.status(404).json({ message: "Travel not found" });
    }
    return res.status(200).json(travel);
  }
  catch (error) {
    console.error("Error getting travel details:", error);
  }
}

module.exports.driverstatuslocationupdate = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { longitude, latitude } = req.body;
    if (!longitude || !latitude) {
      return res.status(400).json({ message: "Longitude and latitude are required" });
    }
    const updatedlocation = await userprofiles.findOneAndUpdate(
      { phoneNumber },
      {
        $set: {
          currentLocation: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          lastUpdated: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedlocation) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const io = getIO();
    io.to(`travel-${travelId}`).emit("locationUpdate", {
      phoneNumber,
      travelId,
      longitude,
      latitude,
      lastUpdated: updatedlocation.lastUpdated,
    });

    res.status(200).json({ message: "Location updated", driver: updatedlocation });
  } catch (error) {
    console.error("Location update failed:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


module.exports.trackRiderLiveLocation = async (req, res, io) => {
  try {
    const { travelId, phoneNumber } = req.params;
    console.log(`Received request to track rider - travelId: ${travelId}, phoneNumber: ${phoneNumber}`);
    const driver = await travelhistory.findOne({ travelId });
    if (!driver) {
      console.log(`Driver not found for travelId: ${travelId}`);
      return res.status(404).json({ message: "Driver not found" });
    }
    console.log(`Driver found: ${JSON.stringify(driver)}`);
    const user = await userprofiles.findOne({ phoneNumber });
    if (!user) {
      console.log(`User not found for phoneNumber: ${phoneNumber}`);
      return res.status(404).json({ message: "User not found" });
    }
    console.log(`User found: ${JSON.stringify(user)}`);
    const { lat, lng, timestamp } = driver.liveLocation;
    if (!lat || !lng) {
      console.log(`Invalid liveLocation data for travelId: ${travelId}`);
      return res.status(400).json({ message: "Invalid location data" });
    }
    const coordinates = [lng, lat];
    console.log(`Converted coordinates - longitude: ${lng}, latitude: ${lat}`);
    const locationData = {
      travelId,
      phoneNumber,
      longitude: lng,
      latitude: lat,
      lastUpdated: timestamp,
    };
    console.log(`Emitting riderLocationUpdate event to room ${travelId} with data: ${JSON.stringify(locationData)}`);
    const io = require('../../socket').getIO();
    io.to(travelId).emit('riderLocationUpdate', locationData);
    console.log('Sending success response to client');
    return res.status(200).json({
      message: "Location update emitted successfully",
      longitude: lng,
      latitude: lat,
      lastUpdated: timestamp,
      coordinates,
    });
  } catch (err) {
    console.error(`Error in trackRiderLiveLocation: ${err.message}`);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};










