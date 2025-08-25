
const ImageKit = require("imagekit");

// Use environment variables for ImageKit configuration
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'public_v9UTcx/y5oJo9HChCccr93By1MQ=',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_FjsCwWK31CW5n57XHn0CaL5K7Nw=',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/btl5ijngo/',
});

module.exports = imagekit;
