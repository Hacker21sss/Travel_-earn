const jwt = require('jsonwebtoken');
const Admin = require('../../admin/model/Admin.model'); 

const authenticateAdmin = async (req, res, next) => {
  try {
    
    const token = req.headers['authorization'];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

 
    const tokenValue = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    
    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    
  
    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

 
    if (!admin.isActive) {
      return res.status(403).json({ message: 'Admin account is inactive' });
    }

   
    req.admin = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    };
    
    next();
  } catch (error) {
    console.error('Admin authentication error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};


const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient privileges' });
    }
    next();
  };
};

module.exports = { authenticateAdmin, authorizeRole };