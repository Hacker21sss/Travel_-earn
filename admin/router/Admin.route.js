const express = require('express');
const { login,createAdmin } = require('../../admin/controller/Admin.controller');
const { authenticateAdmin, authorizeRole } = require('../../admin/Middleware/Adminmiddleware');

const router = express.Router();


router.post('/login', login);


router.post('/signup',  createAdmin);


module.exports = router;
