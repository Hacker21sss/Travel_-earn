const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./user/router/Userrouter')  // Firebase configuration
const profile = require('./user/router/profileroute');
const feedback = require('./user/router/feedbackroute');
const help = require('./user/router/helproute');
const traveldetail = require('./user/router/traveldetailsrouter');
const addressdetail = require('./user/router/recentaddressrouter');
const regionRouter = require('./user/router/regionRouter'); // Import the region router
const instructiondetail = require('./user/router/DeliveryInstructionRoute')
const consignmentdetail = require('./consignment/router/consignment.router')
// const location=require('./user/router/locationroute')
const notification = require('./user/router/notification.route')
const payment = require('./payment/router/payment.route')
const earning = require('./traveller/router/earningroute')
// Initialize express app and load environment variables
const editprofile = require('./user/router/editprofileroute')
const address = require('./traveller/router/addressroute')
const map = require('./traveller/controller/mapscontroller')
const coordinate = require('./traveller/router/coordinate')
const orderhistory = require('./user/router/order.route')
const line = require('./user/router/rating.route')
const location = require('./user/router/locationroute')
const rideroute = require('./traveller/router/ride.route')
const path = require('path');
const { initializationsocket, getIO } = require('./socket');
const socket = require('./socket');

dotenv.config();
const app = express();
app.use(express.json());


const server = http.createServer(app);

// Middlewares
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT || 5000;
const Mongo_URI = process.env.MONGO_URI;
console.log(`Mongo_URI: ${Mongo_URI}`);
console.log(`JWT Secret: ${process.env.JWT_SECRET}`);
console.log(`Port: ${PORT}`);

const io = initializationsocket(server);
if (io) {
  io.on("connection", (socket) => {
    console.log(`A new client connected: ${socket.id}`);

    
    const phoneNumber = socket.handshake.query.phoneNumber;
    if (phoneNumber) {
      
      mongoose.model('userprofiles').findOneAndUpdate(
        { phoneNumber },
        { socketId: socket.id },
        { new: true, upsert: true }
      )
        .then(() => console.log(`Socket ID ${socket.id} associated with phoneNumber ${phoneNumber}`))
        .catch((err) => console.error(`Error updating socketId for ${phoneNumber}:`, err.message));
    } else {
      console.warn(`No phoneNumber provided for socket ${socket.id}`);
    }

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (phoneNumber) {
        mongoose.model('userprofiles').findOneAndUpdate(
          { phoneNumber },
          { socketId: null },
          { new: true }
        )
          .then(() => console.log(`Socket ID cleared for phoneNumber ${phoneNumber}`))
          .catch((err) => console.error(`Error clearing socketId for ${phoneNumber}:`, err.message));
      }
    });

    
    socket.on("error", (err) => {
      console.error(`Socket error for ${socket.id}:`, err.message);
    });
  });
} else {
  console.error("Failed to initialize Socket.IO");
}


mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', profile, map, line)
app.use('/app', help, earning);
app.use('/feed', feedback);
app.use('/earn', earning)
app.use('/editp', instructiondetail, editprofile)
app.use('/t', traveldetail, regionRouter);
app.use('/address', addressdetail, address);
app.use('/map', coordinate)
app.use('/n', notification)
app.use('/p', payment)
app.use('/order', rideroute, orderhistory)
app.use('/api', consignmentdetail, location)

app.get('/', (req, res) => {
  res.send('Welcome to the server!');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  const activeIO = getIO();
  console.log(`Socket.IO connection status: ${activeIO ? 'Connected' : 'Not connected'}`);
});