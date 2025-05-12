const mapService = require('../../service/mapservice');
const { validationResult, query } = require('express-validator'); // Import query from express-validator
const express = require('express');
const router = express.Router();

// module.exports.getDistanceTime = async (req, res) => {
//     try {
//         // Validate query parameters
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }

//         const { origin, destination } = req.query;

//         // Log the inputs for debugging
//         console.log('Origin:', origin);
//         console.log('Destination:', destination);

//         // Call the service to get distance and time
//         const distanceTime = await mapService.getDistanceTime(origin, destination);

//         // Send response
//         res.status(200).json(distanceTime);

//     } catch (err) {
//         console.error('Error fetching distance and time:', err.message);
//         res.status(500).json({ message: 'Internal server error', error: err.message });
//     }
// };
// Define the route with validation middleware


module.exports = router;
module.exports.getCoordinates = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { address } = req.query;
  if (!address) {
    return res.status(400).json({ message: 'Address is required' });
  }

  try {
    const coordinates = await mapService.getAddressCoordinate(address);
    res.status(200).json(coordinates);
  } catch (error) {
    res.status(404).json({ message: 'Coordinates not found' });
  }
};
module.exports.getDistanceTime = async (req, res) => {
  try {
    const { origin, destination } = req.query; // Extract origin and destination from query params

    // Validate input
    if (!origin || !destination) {
      return res.status(400).json({ message: 'Origin and destination are required' });
    }

    // Call the getDistanceTime function
    const result = await mapService.getDistanceTime(origin, destination);

    // Respond with the distance and time data
    res.status(200).json({
      message: 'Distance and time fetched successfully',
      data: result
    });
  } catch (err) {
    console.error('Error fetching distance and time:', err);
    res.status(500).json({
      message: 'Error fetching distance and time',
      error: err.message
    });
  }
};
module.exports.getAutoCompleteSuggestions = async (req, res, next) => {

  try {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { input } = req.query;

    const suggestions = await mapService.getAutoCompleteSuggestions(input);

    res.status(200).json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports.getDistanceTimeandcoordiante= async (req, res) => {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ message: 'Origin and destination are required' });
    }
const {distance,duration} = await mapService.getDistanceTime(origin, destination);
const originCoordinates = await mapService.getAddressCoordinate(origin);

    


    const destinationCoordinates = await mapService.getAddressCoordinate(destination);
    const distanceText = distance.text;  // "171 km"
    const durationText = duration.text;
    

    res.status(200).json({
      message: 'Distance, time, and coordinates fetched successfully',
      distance:distanceText ,
      duration:durationText ,
      originCoordinates,
      destinationCoordinates
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports.calculateETA = async (origin, destination) => {
  if (!origin || !destination) {
      throw new Error('Origin and destination are required for ETA calculation');
  }
  
  // Format coordinates if objects are provided
  let originStr = origin;
  let destinationStr = destination;
  console.log('Origin:', origin, 'Destination:', destination); 
  
  if (typeof origin === 'object') {
      originStr = `${origin.lat || origin.ltd},${origin.lng}`;
  }
  
  if (typeof destination === 'object') {
      destinationStr = `${destination.lat || destination.ltd},${destination.lng}`;
  }
  
  
  try {
      console.log('Calculating ETA for:', originStr, destinationStr); 
      const result = await module.exports.getDistanceTime(originStr, destinationStr);
      console.log('ETA result:', result); // Debugging
      return {
          duration: result.duration.value, // seconds
          durationText: result.duration.text,
          distance: result.distance
      };
  } catch (err) {
      console.error('ETA calculation error:', err);
      throw new Error(`Unable to calculate ETA: ${err.message}`);
  }
};
 

