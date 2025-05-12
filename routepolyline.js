const axios = require('axios');
const mapservice = require('./service/mapservice');

exports.getRouteWithPolyline = async (req, res) => {
  const { Leavinglocation, Goinglocation } = req.query;

  if (!Leavinglocation || !Goinglocation) {
    return res.status(400).json({ message: 'Leaving and Going locations are required' });
  }

  try {
    // Get coordinates for Leaving and Going locations
    const LeavingCoordinates = await mapservice.getAddressCoordinate(Leavinglocation);
    const GoingCoordinates = await mapservice.getAddressCoordinate(Goinglocation);
    console.log(LeavingCoordinates);

    if (!LeavingCoordinates || !GoingCoordinates) {
      return res.status(400).json({ message: 'Unable to fetch coordinates' });
    }

    // Google Maps Directions API Key (Replace with your own)
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

    // Google Directions API Request
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${LeavingCoordinates.ltd},${LeavingCoordinates.lng}&destination=${GoingCoordinates.ltd},${GoingCoordinates.lng}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(directionsUrl);
    const route = response.data.routes[0];

    if (!route) {
      return res.status(400).json({ message: 'No route found' });
    }

    // Extract polyline points
    const polyline = route.overview_polyline.points;

    return res.status(200).json({
      message: 'Route fetched successfully',
      polyline,
      distance: route.legs[0].distance.text,
      duration: route.legs[0].duration.text,
    });

  } catch (error) {
    console.error('Error fetching route:', error.message);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
