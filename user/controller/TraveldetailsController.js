const Traveldetails = require('../../user/model/traveldetails');
const mapservice = require('../../service/mapservice');
const userprofiles = require('../../user/model/Profile');
const fare = require('../../service/price.service');
const { v4: uuidv4 } = require('uuid');
const consignmentData = require('../../consignment/model/contraveldetails');
const Request = require('../../user/model/requestforcarry');
const travelhistory = require("../../user/model/travel.history");
const moment = require("moment");
const { getIO, sendMessageToSocketId } = require('../../socket');
const Notification = require('../../user/model/notification')
const datetime = require('../../service/getcurrentdatetime')
const User = require('../model/User');
const con = require('../../consignment/model/conhistory')

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
  const { phoneNumber, travelDate, vehicleType, stayDays, stayHours,endDate, travelmode_number, travelMode, expectedStartTime, expectedEndTime, weight, fullFrom, fullTo } = req.body;
  const { Leavinglocation, Goinglocation } = req.query;
  const user = await userprofiles.findOne({ phoneNumber });
  console.log("Fetched User:", user);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!Leavinglocation || !Goinglocation) {
    return res.status(400).json({ message: "Leaving and Going locations are required" });
  }

  const currentDate = new Date();
  const sendingDate = new Date(travelDate);
  if (sendingDate < currentDate.setHours(0, 0, 0, 0)) {
    return res.status(400).json({ message: "Please put a valid date" });
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

    // const price = await fare.calculateFare(weightValue, distanceValue, travelMode);
    const rideId = uuidv4();
    const travelId = Math.floor(100000000 + Math.random() * 900000000).toString();

    // Parse time strings and create proper ISO dates without timezone issues
    const parseTimeToISO = (dateString, timeString) => {
      try {
        const dateObj = new Date(dateString);
        
        // Validate date
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date format: ${dateString}`);
        }
        
        const timeMatch = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
        
        if (!timeMatch) {
          throw new Error(`Invalid time format: ${timeString}. Expected format: "hh:mm AM/PM"`);
        }
        
        const [, hours, minutes, period] = timeMatch;
        let hour = parseInt(hours);
        const minute = parseInt(minutes);
        const isPM = period.toUpperCase() === 'PM';
        
        // Validate time components
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
          throw new Error(`Invalid time values: ${timeString}`);
        }
        
        // Convert 12-hour format to 24-hour format
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        
        // Create date in local timezone to avoid timezone conversion issues
        const resultDate = new Date(
          dateObj.getFullYear(),
          dateObj.getMonth(),
          dateObj.getDate(),
          hour,
          minute
        );
        
        // Validate final date
        if (isNaN(resultDate.getTime())) {
          throw new Error(`Failed to create valid date from ${dateString} ${timeString}`);
        }
        
        return resultDate.toISOString();
      } catch (error) {
        console.error("Date parsing error:", error.message);
        throw new Error(`Date parsing failed: ${error.message}`);
      }
    };

    let expectedStart, expectedEnd;
    
    try {
      expectedStart = parseTimeToISO(travelDate, expectedStartTime);
      expectedEnd = parseTimeToISO(endDate, expectedEndTime);
      
      // Debug logging for date parsing
      console.log("Date parsing debug:", {
        input: {
          travelDate,
          expectedStartTime,
          endDate,
          expectedEndTime
        },
        output: {
          expectedStart,
          expectedEnd,
          expectedStartLocal: new Date(expectedStart).toLocaleString(),
          expectedEndLocal: new Date(expectedEnd).toLocaleString()
        }
      });
    } catch (error) {
      console.error("Date parsing failed:", error.message);
      return res.status(400).json({ 
        message: "Invalid date or time format", 
        error: error.message,
        expectedFormat: "Date: YYYY-MM-DD, Time: hh:mm AM/PM"
      });
    }

    let travelDetails = {
      stayDays,
      stayHours,
      vehicleType,
      endDate,
      phoneNumber,
      username,
      Leavinglocation,
      Goinglocation,
      fullFrom,
      fullTo,
      travelDate,
      travelmode_number,
      travelMode,
      expectedStartTime: expectedStart,
      expectedEndTime: expectedEnd,
      // expectedearning: price,
      // payableAmount: price,
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
    console.log("travelDetails", travelDetails);

    const travelRecord = await Traveldetails.create(travelDetails);
    console.log("Created travel record:", travelRecord);

    const now = moment();
    let Status = "UPCOMING";
    if (now.isBetween(moment(expectedStart), moment(expectedEnd))) {
      Status = "Ongoing";
    } else if (now.isAfter(moment(expectedEnd))) {
      Status = "EXPIRED";
    }
    console.log("Status", Status)
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
      // liveLocation: {
      //   lat: LeavingCoordinates.ltd,
      //   lng: LeavingCoordinates.lng
      // },
      // GoingCoordinates: {
      //   ltd: GoingCoordinates.ltd,
      //   lng: GoingCoordinates.lng
      // },
      status: Status
    });

    await history.save();
    console.log("Created history record:", history);

    // Verify the data was stored correctly
    const verifyTravel = await Traveldetails.findOne({ travelId });
    const verifyHistory = await travelhistory.findOne({ travelId });
    console.log("Verification - Travel Record:", {
      leavingCoords: verifyTravel.LeavingCoordinates,
      goingCoords: verifyTravel.GoingCoordinates,
      travelMode: verifyTravel.travelMode,
      travelDate: verifyTravel.travelDate
    });
    console.log("Verification - History Record:", {
      leavingCoords: verifyHistory.LeavingCoordinates,
      goingCoords: verifyHistory.GoingCoordinates,
      travelMode: verifyHistory.travelMode,
      travelDate: verifyHistory.expectedStartTime
    });
    console.log("Verification done")

    return res.status(201).json({
      message: "Travel detail created successfully",
      travelRecord: {
        ...travelRecord._doc,
        distance,
        duration,
        // payableAmount: price,
        travelId,
      },
    });
  } catch (error) {
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
    const { leavingLocation, goingLocation, date, travelMode: originalTravelMode, phoneNumber } = req.query;
    console.log("Received search query:", { leavingLocation, goingLocation, date, travelMode: originalTravelMode });
    
    // Convert travel mode: car -> roadways
    let travelMode = originalTravelMode;
    if (travelMode === "car") {
      travelMode = "roadways";
    }
    if (!travelMode) {
      travelMode = "roadways"; // Default to roadways instead of car
    }
    if (!leavingLocation || !goingLocation || !date) {
      return res.status(400).json({ message: "Leaving location, going location, and date are required" });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    // Convert the input date to start and end of day
    const searchDate = new Date(date);
    const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));

    console.log("Date range for search:", { startOfDay, endOfDay });

    const { distance } = await mapservice.getDistanceTime(leavingLocation, goingLocation);
    if (!distance || !distance.text) {
      return res.status(400).json({ message: "Unable to calculate distance. Please check the locations." });
    }

    const distanceText = distance.text;
    const distanceValue = parseFloat(distanceText.replace(/[^\d.]/g, ""));
    console.log("Distance value:", distanceValue);

    const leavingCoords = await mapservice.getAddressCoordinate(leavingLocation);
    const goingCoords = await mapservice.getAddressCoordinate(goingLocation);

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
    const exactQuery = {
      "LeavingCoordinates.ltd": leavingCoords.ltd,
      "LeavingCoordinates.lng": leavingCoords.lng,
      "GoingCoordinates.ltd": goingCoords.ltd,
      "GoingCoordinates.lng": goingCoords.lng,
      travelDate: { $gte: startOfDay, $lt: endOfDay },
      phoneNumber: { $ne: phoneNumber }
    };

    let exactRides = await Traveldetails.find(exactQuery).lean();
    console.log("Found rides with exact coordinate matching:", exactRides.length);

    // If no exact matches, try bounding box approach
    const baseQuery = {
      "LeavingCoordinates.ltd": { $gte: leavingBoundingBox.minLat, $lte: leavingBoundingBox.maxLat },
      "LeavingCoordinates.lng": { $gte: leavingBoundingBox.minLng, $lte: leavingBoundingBox.maxLng },
      "GoingCoordinates.ltd": { $gte: goingBoundingBox.minLat, $lte: goingBoundingBox.maxLat },
      "GoingCoordinates.lng": { $gte: goingBoundingBox.minLng, $lte: goingBoundingBox.maxLng },
      travelDate: { $gte: startOfDay, $lt: endOfDay },
      phoneNumber: { $ne: phoneNumber }
    };

    // Use exact rides if found, otherwise use bounding box approach
    let availableRides = exactRides;
    
    if (exactRides.length === 0) {
      const query = travelMode && travelMode.trim() !== ""
        ? { 
            ...baseQuery, 
            $or: [
              { travelMode },
              { vehicleType: travelMode }
            ]
          }
        : baseQuery;

      availableRides = await Traveldetails.find(query).lean();
    } else {
      // Filter exact rides by travel mode if specified
      if (travelMode && travelMode.trim() !== "") {
        availableRides = exactRides.filter(ride => 
          ride.travelMode === travelMode || ride.vehicleType === travelMode
        );
      }
    }
    console.log("Found rides before distance filtering:", availableRides.length);
    
    // Debug: Check all rides for the date without location filtering
    const allRidesForDate = await Traveldetails.find({
      travelDate: { $gte: startOfDay, $lt: endOfDay },
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
        travelMode: ride.travelMode
      })));
    }

    // Apply precise distance filtering (skip if we have exact matches)
    let filteredRides = availableRides;
    
    if (exactRides.length === 0) {
      filteredRides = availableRides.filter(ride => {
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
          leavingDistance,
          goingDistance,
          leavingCoords: ride.LeavingCoordinates,
          goingCoords: ride.GoingCoordinates,
          searchLeavingCoords: leavingCoords,
          searchGoingCoords: goingCoords
        });

        // Use a smaller radius for more precise matching (1km instead of 10km)
        const preciseRadiusInMeters = 1 * 1000; // 1km
        return leavingDistance <= preciseRadiusInMeters && goingDistance <= preciseRadiusInMeters;
      });
    } else {
      console.log("Using exact coordinate matches, skipping distance filtering");
    }

    console.log("Available rides after filtering:", filteredRides.length);

    if (!filteredRides.length) {
      // Try alternative matching: check if any rides have the same location names
      console.log("No rides found with coordinate matching, trying location name matching...");
      
      const alternativeRides = allRidesForDate.filter(ride => {
        const leavingMatch = ride.Leavinglocation.toLowerCase().includes(leavingLocation.toLowerCase()) ||
                           leavingLocation.toLowerCase().includes(ride.Leavinglocation.toLowerCase());
        const goingMatch = ride.Goinglocation.toLowerCase().includes(goingLocation.toLowerCase()) ||
                          goingLocation.toLowerCase().includes(ride.Goinglocation.toLowerCase());
        
        console.log("Alternative matching for ride:", {
          rideId: ride.rideId,
          rideLeaving: ride.Leavinglocation,
          rideGoing: ride.Goinglocation,
          searchLeaving: leavingLocation,
          searchGoing: goingLocation,
          leavingMatch,
          goingMatch
        });
        
        return leavingMatch && goingMatch;
      });
      
      if (alternativeRides.length > 0) {
        console.log("Found rides using location name matching:", alternativeRides.length);
        const ridesWithProfile = await Promise.all(
          alternativeRides.map(async (ride) => {
            const userProfile = await userprofiles.findOne(
              { phoneNumber: ride.phoneNumber },
              { profilePicture: 1, totalrating: 1, averageRating: 1 }
            ).lean();
            return {
              ...ride,
              profilePicture: userProfile?.profilePicture || null,
              rating: userProfile?.totalrating || 0,
              averageRating: userProfile?.averageRating || 0,
              matchType: "location_name"
            };
          })
        );
        
        // Convert roadways to car for fare calculation
        const fareTravelMode = travelMode === "roadways" ? "car" : (travelMode || "car");
        const estimatedFare = await fare.calculateFarewithoutweight(distanceValue, fareTravelMode);
        
        return res.status(200).json({
          availableRides: ridesWithProfile,
          estimatedFare,
          calculatedPrice: estimatedFare,
          searchParams: {
            leavingLocation,
            goingLocation,
            date,
            travelMode,
            leavingCoords,
            goingCoords,
            matchType: "location_name"
          }
        });
      }
      
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
    const estimatedFare = await fare.calculateFarewithoutweight(distanceValue, fareTravelMode);

    if (estimatedFare === undefined) {
      return res.status(500).json({ message: "Error calculating estimated fare." });
    }
    console.log("Estimated fare:", estimatedFare);

    // Search for user's consignment to calculate correct price
    let userConsignment = null;
    let calculatedPrice = null;
    
    if (phoneNumber) {
      try {
        // Search for consignment created on the given date
        userConsignment = await consignmentData.findOne({
          phoneNumber: phoneNumber,
          dateOfSending: { $gte: startOfDay, $lt: endOfDay }
        }).sort({ createdAt: -1 });

        if (userConsignment) {
          console.log("Found user consignment:", {
            consignmentId: userConsignment?.consignmentId,
            weight: userConsignment?.weight,
            dimensions: userConsignment?.dimensions,
            distance: userConsignment?.distance
          });

          // Extract weight and distance from consignment
          const weight = parseFloat(userConsignment.weight?.toString().replace(/[^\d.]/g, ""));
          const consignmentDistance = parseFloat(userConsignment.distance?.toString().replace(/[^\d.]/g, ""));

          if (!isNaN(weight) && !isNaN(consignmentDistance)) {
            // Extract dimensions if available
            const dimensions = userConsignment.dimensions;
            const length = dimensions?.length ? parseFloat(dimensions.length) : null;
            const height = dimensions?.height ? parseFloat(dimensions.height) : null;
            const breadth = dimensions?.breadth ? parseFloat(dimensions.breadth) : null;

            // Calculate fare using the fare service with consignment data
            calculatedPrice = await fare.calculateFare(
              weight, 
              consignmentDistance, 
              fareTravelMode, 
              length, 
              height, 
              breadth
            );

            console.log("Calculated price from consignment:", {
              weight,
              distance: consignmentDistance,
              travelMode: fareTravelMode,
              dimensions: { length, height, breadth },
              calculatedPrice
            });
          } else {
            console.log("Invalid weight or distance in consignment, using estimated fare");
            calculatedPrice = estimatedFare;
          }
        } else {
          console.log("No consignment found for user on the given date, using estimated fare");
          calculatedPrice = estimatedFare;
        }
      } catch (error) {
        console.error("Error calculating price from consignment:", error);
        calculatedPrice = estimatedFare;
      }
    } else {
      calculatedPrice = estimatedFare;
    }

    res.status(200).json({
      availableRides: ridesWithProfile,
      estimatedFare,
      calculatedPrice,
      userConsignment: userConsignment ? {
        consignmentId: userConsignment.consignmentId,
        weight: userConsignment.weight,
        dimensions: userConsignment.dimensions,
        distance: userConsignment.distance,
        dateOfSending: userConsignment.dateOfSending
      } : null,
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
  const { phoneNumber, rideId } = req.body;
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Check for consignment created on the current date
    const con = await consignmentData
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

    const ride = await Traveldetails.findOne({ rideId });
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
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
    const travelMode = ride.travelMode ? ride.travelMode === "roadways" ? "car" : ride.travelMode.toLowerCase().trim() : null;

    if (!validModes.includes(travelMode)) {
      return res.status(400).json({ message: "Invalid Travel Mode! Please enter 'train' or 'airplane'." });
    }

    const weight = con.weight ? parseFloat(con.weight.toString().replace(/[^\d.]/g, "")) : NaN;
    const distance = con.distance ? parseFloat(con.distance.toString().replace(/[^\d.]/g, "")) : NaN;

    if (isNaN(weight) || isNaN(distance)) {
      return res.status(400).json({ message: "Invalid Weight or Distance! Please provide valid numbers." });
    }

    if (typeof fare.calculateFare !== "function") {
      return res.status(500).json({ message: "Fare calculation function is missing or not defined." });
    }

    // Calculate fare and await the result
    const fareResult = await fare.calculateFare(weight, distance, travelMode);
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
        expectedEarning,
        travelId: ride.travelId
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










