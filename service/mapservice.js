const axios = require('axios');
const drivermodel = require('../traveller/model/traveller');

// 1️⃣ Get coordinates from address
module.exports.getAddressCoordinate = async (address) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    try {
        console.log('📍 Geocode URL:', url);
        const response = await axios.get(url);
        console.log('📦 Geocode response:', response.data);

        if (response.data.status === 'OK') {
            const location = response.data.results[0].geometry.location;
            return {
                ltd: location.lat,
                lng: location.lng
            };
        } else {
            console.error('❌ Geocode API status:', response.data.status);
            throw new Error('Unable to fetch coordinates');
        }
    } catch (error) {
        console.error('🚨 Geocode error:', error.message);
        throw error;
    }
};

// 2️⃣ Get autocomplete suggestions
module.exports.getAutoCompleteSuggestions = async (input) => {
    if (!input) {
        throw new Error('query is required');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;

    try {
        console.log('🔤 Autocomplete URL:', url);
        const response = await axios.get(url);
        console.log('📦 Autocomplete response:', response.data);

        if (response.data.status === 'OK') {
            return response.data.predictions.map(prediction => prediction.description).filter(value => value);
        } else {
            console.error('❌ Autocomplete API status:', response.data.status);
            throw new Error('Unable to fetch suggestions');
        }
    } catch (err) {
        console.error('🚨 Autocomplete error:', err.message);
        throw err;
    }
};

// 3️⃣ Get distance and time
module.exports.getDistanceTime = async (origin, destination) => {
    if (!origin || !destination) {
        throw new Error('Origin and destination are required');
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;

    try {
        console.log('🛣️ Distance Matrix URL:', url);
        const response = await axios.get(url);
        console.log('📦 Distance Matrix response:', response.data);

        if (response.data.status === 'OK') {
            if (response.data.rows[0].elements[0].status === 'ZERO_RESULTS') {
                console.warn('⚠️ No route found between:', origin, 'and', destination);
                throw new Error('No routes found');
            }

            return response.data.rows[0].elements[0];
        } else {
            console.error('❌ Distance Matrix API status:', response.data.status);
            throw new Error('Unable to fetch distance and time');
        }
    } catch (err) {
        console.error('🚨 Distance Matrix error:', err.message);
        throw err;
    }
};
