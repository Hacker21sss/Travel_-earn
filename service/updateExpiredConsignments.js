const cron = require('node-cron')
const consignment = require('../consignment/model/contraveldetails')

const updateConsignments = async () => {
    try {
        const now = new Date();

        const result = await consignment.updateMany(
            {
                dateOfSending: { $lt: now },
                status: { $in: ['Pending', 'Not Started'] }
            },
            {
                $set: { status: 'Expired' }
            }
        )

        console.log("Expired consignments: ", result);
    }
    catch(err){
        console.log("Error while updating consignment status", err);
    }
}

module.exports.startConsignmentCronJob = ()=>{
    cron.schedule('0 0 0 * * *', async()=>{
        console.log("Running cron job")
        await updateConsignments();
    })
}