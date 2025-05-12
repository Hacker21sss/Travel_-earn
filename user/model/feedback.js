const mongoose = require('mongoose');
const user=require('../../user/model/Profile')

const feedbackSchema = new mongoose.Schema({
  phoneNumber:{type:String,ref:user},
  feedbackmessage: { type: String, required: true },
  subject: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
