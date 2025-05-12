const mongoose = require("mongoose");
const user = require("../../user/model/Profile");
const travel = require("../../user/model/traveldetails");
const cons = require("../../consignment/model/contraveldetails");

const travelhistorySchema = new mongoose.Schema(
    {
        phoneNumber: { type: String, ref: user },
        pickup: { type: String, ref: travel },
        drop: { type: String, ref: travel },
        travelId: { type: String, ref: travel },
        travelMode: { type: String, ref: travel },
        travelmode_number:{type:String, ref:travel},
        status: {
            type: String,
            enum: ["UPCOMING",  "CANCELLED", "ENDED","STARTED"],
        },
        consignments: { type: Number, default: 0 },
        traveldate: { type: String },
        expectedStartTime: { type: String, ref: travel },
        expectedendtime:{ type: String, ref: travel },
       liveLocation: {
            lat: { type: Number },
            lng: { type: Number },
            timestamp: { type: Date, default: Date.now },
        },
        locationHistory: [
            {
                lat: { type: Number, required: true },
                lng: { type: Number, required: true },
                timestamp: { type: Date, default: Date.now },
            },
          ],

        consignmentDetails: [
            {
                consignmentId: { type: String },
                status: { type: String, enum: ["UPCOMING", "ONGOING", "DELIVERED", "CANCELLED", "EXPIRED"] },
                weight: { type: String, ref: cons },
                dimensions: { type: String, ref: cons },
                pickup: { type: String, },
                drop: { type: String },
                timestamp:{ type: Date, default: Date.now },
            }
        ]
    },
    { timestamps: true }
);
travelhistorySchema.index({ consignmentId: 1, "locationHistory.timestamp": -1 });

module.exports = mongoose.model("travelhistory", travelhistorySchema);
