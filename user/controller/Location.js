const axios = require('axios');
require('dotenv').config();

module.exports.getAutoCompleteSuggestions = async (req, res) => {
  const { going, leaving } = req.query; // Extract query parameters

  if (!going && !leaving) {
    return res.status(400).json({ message: 'At least one query parameter (going or leaving) is required.' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Get API key from environment variables

  try {
    const fetchSuggestions = async (input) => {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;
      const response = await axios.get(url);
      
      if (response.data.status === 'OK') {
        return response.data.predictions.map(prediction => prediction.description);
      } else {
        console.error(`Error from Google API for input "${input}": ${response.data.status}`);
        return [];
      }
    };

    const [goingSuggestions, leavingSuggestions] = await Promise.all([
      going ? fetchSuggestions(going) : [],
      leaving ? fetchSuggestions(leaving) : []
    ]);

    return res.status(200).json({ goingSuggestions, leavingSuggestions });
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error.message);
    return res.status(500).json({ message: 'Failed to fetch suggestions. Please try again later.' });
  }
};
