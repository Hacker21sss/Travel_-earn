const socketio = require("socket.io");
const user = require("./user/model/Profile");

let io;

function initializationsocket(server) {
  io = socketio(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`A new client connected: ${socket.id}`);

    socket.on("join", async (data) => {
      try {
        const { phoneNumber } = data;
        if (!phoneNumber) {
          console.error("❌ Phone number is required to join.");
          socket.emit("error", { message: "Phone number is required" });
          return;
        }

        await user.findOneAndUpdate(
          { phoneNumber },
          { socketId: socket.id },
          { new: true, upsert: true }
        );

        console.log(`📌 User with phone ${phoneNumber} is now connected with socket ${socket.id}`);
        socket.emit("joined", { message: "You are connected", socketId: socket.id });
      } catch (error) {
        console.error("⚠️ Error updating user socketId:", error);
        socket.emit("error", { message: "Failed to join" });
      }
    });
    // socket.on("welcome",(data)=>{
    //   console.log("mess",data);
    // })

    socket.emit("sendmessage", {
      message: "Hello from the server12356!",
      timestamp: new Date().toISOString(),
    });

    // Uncomment if you want clients to join specific ride rooms
    // socket.on("track-ride", (data) => {
    //   const { travelId } = data;
    //   if (!travelId) {
    //     console.error("❌ travelId is required for tracking.");
    //     socket.emit("error", { message: "travelId is required" });
    //     return;
    //   }

    //   socket.join(`travel-${travelId}`);
    //   console.log(`🚗 Client joined tracking room for travel ID: ${travelId}`);
    // });

    socket.on("riderLocation", ({ travelId, latitude, longitude }) => {
      if (!travelId || typeof latitude !== "number" || typeof longitude !== "number") {
        console.error("❌ Invalid riderLocation data:", { travelId, latitude, longitude });
        socket.emit("error", { message: "Invalid location data" });
        return;
      }

      console.log(`Driver Location for ${travelId}: ${latitude}, ${longitude}`);
      // Broadcast to all clients subscribed to this travelId
      io.emit(`locationUpdate:${travelId}`, { latitude, longitude });
      // Optionally, emit to a room if using track-ride
      // io.to(`travel-${travelId}`).emit(`locationUpdate:${travelId}`, { latitude, longitude });
    });

    socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);
      try {
        await user.findOneAndUpdate(
          { socketId: socket.id },
          { socketId: null },
          { new: true }
        );
        console.log(`🗑️ Cleared socketId ${socket.id} from database`);
      } catch (error) {
        console.error("⚠️ Error clearing socketId on disconnect:", error);
      }
    });
  });

  return io;
}

const sendMessageToSocketId = (socketId, messageObject) => {
  if (!io) {
    console.log("❌ Socket.io is not initialized.");
    return;
  }

  console.log(`📤 Sending message to socket ${socketId}:`, messageObject);
  io.to(socketId).emit(messageObject.event, messageObject.data);
};

exports.broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};
exports.pushnotification=(phoneNumber, notification)=>{
  if (io) {
    io.to(phoneNumber).emit("newNotification", notification);
  }
}

module.exports = { initializationsocket, getIO: () => io, sendMessageToSocketId };