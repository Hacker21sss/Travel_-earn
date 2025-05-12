const Admin = require('../../admin/model/Admin.model');
const jwt = require('jsonwebtoken');


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    
    const admin = await Admin.findOne({ email, isActive: true });
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    
    const isMatch = await admin.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
};


exports.createAdmin = async (req, res) => {
  try {
    
    if (!req.admin || req.admin.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin privileges required' });
    }
    
    const { name, email, password, role } = req.body;
    
 
    const existingAdmin = await Admin.findOne({ email });
    
    if (existingAdmin) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    
 
    const newAdmin = new Admin({
      name,
      email,
      password,
      role: role || 'support'
    });
    
    await newAdmin.save();
    
    res.status(201).json({
      message: 'Admin account created successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error('Error creating admin account:', error);
    res.status(500).json({ message: 'Error creating admin account', error: error.message });
  }
};
