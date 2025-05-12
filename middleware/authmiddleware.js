const jwt = require('jsonwebtoken');
const Userprofile = require('../user/model/Profile');



exports.authenticate = async (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: 'Authorization token is missing.' });
  }

  try {
    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7).trim() : token;
    const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);

    const user = await Userprofile.findOne({ phoneNumber: decoded.phoneNumber });
    if (!user) {
      return res.status(401).json({ message: 'Authentication failed. User not found.' });
    }

    req.user = user;
    req.phoneNumber = user.phoneNumber;

    next();
 
  } catch (err) {
    res.status(401).json({ message: 'Authentication failed.' });
  }
};

