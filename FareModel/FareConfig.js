const mongoose = require('mongoose');

const FareConfigSchema = new mongoose.Schema({
  TE: { type: Number, default: 112 },
  deliveryFee: { type: Number, default: 0 },
  margin: { type: Number, default: 0.2 }, // 20%
  weightRateTrain: { type: Number, default: 100 },
  weightRateAirplane: { type: Number, default: 200 },
  distanceRateTrain: {type : Number},
  distanceRateAirplane: { type: Number, default: 0.2 },
  baseFareTrain: { type: Number},
  baseFareAirplane: { type: Number},
}, { timestamps: true });

module.exports = mongoose.model('FareConfig', FareConfigSchema);
