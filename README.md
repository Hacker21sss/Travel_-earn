# Travel & Earn Backend

## Introduction
Travel & Earn is a backend application designed to facilitate a platform where users can send consignments, track deliveries, and earn by traveling. The backend provides RESTful APIs, real-time updates, authentication, and integrations for payments and notifications.

## Features
- **User Management:** Registration, authentication, profile management, feedback, and notifications.
- **Consignment Handling:** Create, update, and track consignments with support for multiple image uploads.
- **Real-Time Tracking:** Live location updates and notifications using Socket.IO.
- **Payment Integration:** Secure payment processing and history.
- **Admin Panel:** Admin routes for managing users, consignments, and platform settings.
- **Fare Calculation:** Dynamic fare calculation based on distance, weight, and travel mode.
- **Robust Middleware:** Authentication, rate limiting, security headers, and file upload handling.

## Tech Stack
- **Node.js** & **Express**: Core backend framework
- **MongoDB** & **Mongoose**: Database and ODM
- **Socket.IO**: Real-time communication
- **JWT**: Authentication
- **Multer & ImageKit**: File uploads and cloud storage
- **Razorpay**: Payment gateway
- **Winston**: Logging
- **Other dependencies:** axios, dotenv, helmet, compression, cors, express-validator, etc.

## Project Structure
```
├── admin/           # Admin controllers, models, routers, middleware
├── consignment/     # Consignment logic (router, controller, model)
├── FareModel/       # Fare calculation configuration
├── logs/            # Log files
├── middleware/      # Custom middleware (auth, upload, etc.)
├── payment/         # Payment logic (controller, config, router)
├── service/         # Business logic/services (pricing, cron jobs, etc.)
├── traveller/       # Traveller logic (controller, model, router)
├── user/            # User logic (controller, model, router, service)
├── index.js         # Main entry point
├── socket.js        # Socket.IO setup
├── routepolyline.js # Route and polyline logic
├── package.json     # Project metadata and dependencies
```

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Hacker21sss/Travel_-earn.git
   cd Travel_-earn
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=7755
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   FRONTEND_URI=your_frontend_url
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ... (add any other required keys)
   ```
4. **Run the server:**
   ```bash
   npm start
   # or for development with auto-reload
   npm run run
   ```

## API Overview
- **User APIs:** `/api/auth`, `/api`, `/app`, `/feed`, `/editp`, `/t`, `/address`, `/map`, `/n`, `/p`, `/order`
- **Consignment APIs:** `/api/consignment` (see [CONSIGNMENT_UPLOAD_README.md](./CONSIGNMENT_UPLOAD_README.md))
- **Address APIs:** `/address` (see [ADDRESS_API_README.md](./ADDRESS_API_README.md))
- **Real-Time Tracking:** `/track-rider/:travelId/:phoneNumber`
- **Route Polyline:** `/routepolyline`

For detailed API documentation, refer to the respective `*_README.md` files in the project.

## Authentication
- JWT-based authentication is enforced using middleware (`middleware/authmiddleware.js`).
- Pass the token in the `Authorization` header as `Bearer <token>`.

## Real-Time Communication
- Socket.IO is used for live updates (location, notifications, etc.).
- See `socket.js` for event details and integration.

## File Uploads
- Uses Multer for handling file uploads (see `middleware/upload.js` and `middleware/multerconfig.js`).
- Consignment images are uploaded to ImageKit (see [CONSIGNMENT_UPLOAD_README.md](./CONSIGNMENT_UPLOAD_README.md)).

## Testing
- Example test script: `test_address_api.js` (tests address endpoints)
- Run with:
  ```bash
  node test_address_api.js
  ```

## Environment Variables
- `PORT`: Server port (default: 7755)
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT authentication
- `FRONTEND_URI`: Allowed frontend origin for CORS
- `GOOGLE_MAPS_API_KEY`: For route and polyline features
- ...and others as required by payment, cloud storage, etc.

## Contributing
1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your fork and submit a pull request

## License
This project is licensed under the ISC License.

## Contact
For questions or support, please open an issue on [GitHub](https://github.com/Hacker21sss/Travel_-earn/issues). 