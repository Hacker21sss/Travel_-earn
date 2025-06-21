const consignmenttocarry=require('../../traveller/model/consignmenttocarry');
const user=require('../../user/model/Profile');



module.exports. consignmenttocarry=async(req,res)=>{
    const {travelId}=req.params;


    try{
       const consige = await consignmenttocarry.find({ travelId });
        if(!consige){
            return res.status(404).json({message:'no request available '});
        } 

            return res.status(200).json({
                message:'Consignment found',
                consige: [consige]
            });
        }

        






        catch (error) {
            console.error("Error occurred:", error);
            return res.status(500).json({ message: "An error occurred", error: error.message });
        }
}