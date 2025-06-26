const cron = require('node-cron')
const consignment = require('../consignment/model/contraveldetails')
const consignmentHistory = require('../consignment/model/conhistory')

const updateConsignments = async () => {
    try {
        const now = new Date();

        const expiredConsignments = await consignment.find({
            dateOfSending: { $lt: now },
            status: { $in: ['Pending', 'Not Started', "Rejected"] }
        }); 

        console.log("Expired consignments : ", expiredConsignments);

       
        const expiredConsignmentIds = expiredConsignments.map(c => c._id);

        
        const [consignmentUpdateResult, historyUpdateResult] = await Promise.all([await consignment.updateMany(
            {
                consignmentId: { $in: expiredConsignmentIds }
            },
            {
                $set: { status: 'Expired' }
            }
        ),
         await consignmentHistory.updateMany(
            {
                consignmentId: { $in: expiredConsignmentIds }
            },
            {
                $set: { status: 'Expired' }
            }
        )
    ])
    
    console.log(consignmentUpdateResult, historyUpdateResult);

    }   
    catch (err) {
        console.log("Error while updating consignment status", err);
    }
}

module.exports.startConsignmentCronJob = () => {
    cron.schedule('0 0 0 * * *', async () => {
        console.log("Running cron job")
        await updateConsignments();
    })
}