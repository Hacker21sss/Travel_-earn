const mongoose=require("mongoose");
const user=require("../../user/model/User");


const ratingSchema=new mongoose.Schema({
    tphoneNumber: {type:String, ref: user},
    phoneNumber:{type:String,ref:user},
    message:{type:String},
    rate:{type:Number}
});
module.exports = mongoose.model("rating", ratingSchema);

