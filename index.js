const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
//const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
// const path = require('path');

const authRoutes = require('./user/router/Userrouter');
const profile = require('./user/router/profileroute');
const feedback = require('./user/router/feedbackroute');
const help = require('./user/router/helproute');
const traveldetail = require('./user/router/traveldetailsrouter');
const addressdetail = require('./user/router/recentaddressrouter');
const regionRouter = require('./user/router/regionRouter');
const instructiondetail = require('./user/router/DeliveryInstructionRoute');
const consignmentdetail = require('./consignment/router/consignment.router');
const notification = require('./user/router/notification.route');
const payment = require('./payment/router/payment.route');
const earning = require('./traveller/router/earningroute');
const editprofile = require('./user/router/editprofileroute');
const address = require('./traveller/router/addressroute');
const map = require('./traveller/controller/mapscontroller');
const coordinate = require('./traveller/router/coordinate');
const orderhistory = require('./user/router/order.route');
const line = require('./user/router/rating.route');
const location = require('./user/router/locationroute');
const rideroute = require('./traveller/router/ride.route');
const { initializationsocket, getIO } = require('./socket');
const trackRiderLiveLocation=require('./user/controller/TraveldetailsController')
// Importing the consignment cron job
const {startConsignmentCronJob} = require('./service/updateExpiredConsignments')


dotenv.config();

const app = express();

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true }
});
app.use(limiter);


const server = http.createServer(app);

server.keepAliveTimeout = 2000;

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console());
}

const corsOptions = {
    origin: process.env.FRONTEND_URI || 'https://www.timestringssystem.com',
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type', 'Access-Control-Allow-Origin'],
    exposedHeaders: ['Content-Type', 'Access-Control-Allow-Origin'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(express.json());
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));





app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${res.statusCode}`);
    next();
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => logger.info('MongoDB connected'))
    .catch((err) => logger.error('MongoDB connection error: ' + err.message));

const io = initializationsocket(server);
if (io) {
    io.on("connection", (socket) => {
        logger.info(`A new client connected: ${socket.id}`);
        const phoneNumber = socket.handshake.query.phoneNumber;
        if (phoneNumber) {
            mongoose.model('userprofiles').findOneAndUpdate(
                { phoneNumber },
                { socketId: socket.id },
                { new: true, upsert: true }
            )
                .then(() => logger.info(`Socket ID ${socket.id} associated with phoneNumber ${phoneNumber}`))
                .catch((err) => logger.error(`Error updating socketId for ${phoneNumber}: ${err.message}`));
        } else {
            logger.warn(`No phoneNumber provided for socket ${socket.id}`);
        }

        socket.on("disconnect", () => {
            logger.info(`Client disconnected: ${socket.id}`);
            if (phoneNumber) {
                mongoose.model('userprofiles').findOneAndUpdate(
                    { phoneNumber },
                    { socketId: null },
                    { new: true }
                )
                    .then(() => logger.info(`Socket ID cleared for phoneNumber ${phoneNumber}`))
                    .catch((err) => logger.error(`Error clearing socketId for ${phoneNumber}: ${err.message}`));
            }
        });

        socket.on("error", (err) => {
            logger.error(`Socket error for ${socket.id}: ${err.message}`);
        });
    });
} else {
    logger.error("Failed to initialize Socket.IO");
}

app.use('/api/auth', authRoutes);
app.use('/api', profile, map, line);
app.use('/app', help, earning);
app.use('/feed', feedback);
app.use('/earn', earning);
app.use('/editp', instructiondetail, editprofile);
app.use('/t', traveldetail, regionRouter);
app.use('/address', addressdetail, address);
app.use('/map', coordinate);
app.use('/n', notification);
app.use('/p', payment);
app.use('/order', rideroute, orderhistory);
app.use('/api', consignmentdetail, location);
app.get('/track-rider/:travelId/:phoneNumber', (req, res) => {
  trackRiderLiveLocation.trackRiderLiveLocation(req, res, io);
});

app.get('/', (req, res) => {
    res.send('Welcome to the server!');
});

app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 7755;

// Starting the consignment job
// startConsignmentCronJob();

server.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    const activeIO = getIO();
    logger.info(`Socket.IO connection status: ${activeIO ? 'Connected' : 'Not connected'}`);
});
