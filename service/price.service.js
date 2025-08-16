const FareConfig = require('../FareModel/FareConfig')

module.exports.dimension = (length, height, breadth) => {
   
    if (
        !length ||
        !height ||
        !breadth ||
        isNaN(length) ||
        isNaN(height) ||
        isNaN(breadth) ||
        length <= 0 ||
        height <= 0 ||
        breadth <= 0
    ) {
        console.log("Invalid dimensions: Length, height, and breadth must be positive numbers.");
        return null;
    }

    // Fixed dimensional factor (cm³/kg)
    const dimensionalFactor = 5000;

    // Calculate dimensional weight: (length * height * breadth) / dimensionalFactor
    const dimensionalWeight = (length * height * breadth) / dimensionalFactor;
    console.log(`Dimensional Weight: ${dimensionalWeight.toFixed(2)} kg`);

    return dimensionalWeight;
};

// module.exports.calculateFare = (weight, distance, travelMode, length, height, breadth) => {
//     // Validate inputs
//     if (
//         !weight ||
//         !distance ||
//         isNaN(weight) ||
//         isNaN(distance) ||
//         weight <= 0 ||
//         distance <= 0
//     ) {
//         console.log("Invalid weight or distance: Must be positive numbers.");
//         return "Error: Invalid weight or distance";
//     }

//     if (!travelMode) {
//         console.log("Travel mode is required.");
//         return "Error: Travel mode is required";
//     }

//     let weightFare = 0;
//     let distanceFare = 0;
//     let TE = 112;

//     travelMode = travelMode.toLowerCase();

//     console.log(`Travel Mode: ${travelMode}`);
//     console.log(`Actual Weight: ${weight} kg`);
//     console.log(`Distance: ${distance} km`);

    
//     let chargeableWeight = weight;
//     if (length && height && breadth) {
//         const dimensionalWeight = module.exports.dimension(length, height, breadth);
//         if (dimensionalWeight !== null) {
//             chargeableWeight = Math.max(weight, dimensionalWeight);
//             console.log(`Chargeable Weight: ${chargeableWeight.toFixed(2)} kg (Max of ${weight} kg and ${dimensionalWeight.toFixed(2)} kg)`);
//         } else {
//             console.log("Invalid dimensional weight; using actual weight.");
//         }
//     } else {
//         console.log("No dimensions provided; using actual weight.");
//     }

//     if (travelMode === "train" || travelMode === "car") {
//         if (chargeableWeight > 1) {
//             weightFare = (chargeableWeight - 1) * 100;
//         }

//         if (distance > 0 && distance <= 100) {
//             distanceFare = distance * 0.6;
//         } else if (distance > 100 && distance <= 500) {
//             distanceFare = 60 + (distance - 100) * 0.1;
//         } else if (distance > 500) {
//             distanceFare = 100 + (distance - 500) * 0.1;
//         }
//     } else if (travelMode === "airplane") {
//         distanceFare = distance * 0.2;
//         weightFare = chargeableWeight * 200;
//     } else {
//         console.log("Invalid Travel Mode! Please enter 'train', 'car', or 'airplane'.");
//         return "Error: Invalid Travel Mode";
//     }

//     console.log(`Weight Fare: ${weightFare} rupees`);
//     console.log(`Distance Fare: ${distanceFare} rupees`);

//     let totalFare = distanceFare + weightFare;
//     console.log(`Total Fare Before Extra Charges: ${totalFare} rupees`);

//     let senderTotalPay = (totalFare + TE) * 1.2;
//     console.log(`Final Amount (Sender Pays): ${senderTotalPay.toFixed(2)} rupees`);

//     return senderTotalPay.toFixed(2);
// };


module.exports.calculateFare = async (weight, distance, travelMode, length, height, breadth) => {
    console.log(weight, distance, travelMode, length, height, breadth)
    if (!weight || !distance || isNaN(weight) || isNaN(distance) || weight <= 0 || distance <= 0) {
        console.log("Invalid weight or distance: Must be positive numbers.");
        return "Error: Invalid weight or distance";
    }

    if (!travelMode) {
        console.log("Travel mode is required.");
        return "Error: Travel mode is required";
    }

    // Fetch fare config from DB
    const fareConfig = await FareConfig.findOne();
    if (!fareConfig) {
        console.log("Fare configuration not found in database.");
        return "Error: Fare configuration not found";
    }
    console.log(fareConfig);

    let weightFare = 0;
    let distanceFare = 0;
    let totalFare = 0;
    const TE = fareConfig.TE || 0;
    const margin = fareConfig.margin || 0.2;

    travelMode = travelMode.toLowerCase();

    console.log(`Travel Mode: ${travelMode}`);
    console.log(`Actual Weight: ${weight} kg`);
    console.log(`Distance: ${distance} km`);

    let chargeableWeight = weight;
    if (length && height && breadth) {
        const dimensionalWeight = module.exports.dimension(length, height, breadth);
        if (dimensionalWeight !== null) {
            chargeableWeight = Math.max(weight, dimensionalWeight);
            console.log(`Chargeable Weight: ${chargeableWeight.toFixed(2)} kg (Max of ${weight} kg and ${dimensionalWeight.toFixed(2)} kg)`);
        } else {
            console.log("Invalid dimensional weight; using actual weight.");
        }
    } else {
        console.log("No dimensions provided; using actual weight.");
    }

    if (travelMode === "train" || travelMode === "car") {
        console.log(fareConfig.baseFareTrain)
        let baseFare = fareConfig.baseFareTrain;
        console.log("Base Fare:", baseFare);
        if (chargeableWeight > 1) {
            weightFare = (chargeableWeight - 1) * fareConfig.weightRateTrain;
        }

        if(distance > 200){
            const distanceSlabs = Math.ceil((distance - 200)/300);
            distanceFare = distanceSlabs*fareConfig.distanceRateTrain;
        }
        console.log("Distance Fare:", distanceFare);
        console.log("Weight Fare:", weightFare);
        totalFare = baseFare + distanceFare + weightFare;
        // if (distance > 0 && distance <= 200) {
        //     distanceFare = distance * fareConfig.distanceRateTrain.base;
        // } else if (distance > 200 && distance <= 500) {
        //     distanceFare = 
        //         100 * fareConfig.distanceRateTrain.base + 
        //         (distance - 100) * fareConfig.distanceRateTrain.mid;
        // } else if (distance > 500) {
        //     distanceFare = 
        //         100 * fareConfig.distanceRateTrain.base + 
        //         400 * fareConfig.distanceRateTrain.mid + 
        //         (distance - 500) * fareConfig.distanceRateTrain.high;
        // }
    } else if (travelMode === "airplane") {
        let baseFare = fareConfig.baseFareAirplane;
        // distanceFare = distance * fareConfig.distanceRateAirplane;
        // weightFare = chargeableWeight * fareConfig.weightRateAirplane;
        if (chargeableWeight > 1) {
            weightFare = (chargeableWeight - 1) * fareConfig.weightRateAirplane;
        }

        if(distance > 500){
            const distanceSlabs = Math.ceil((distance - 500)/500);
            distanceFare = distanceSlabs*fareConfig.distanceRateAirplane;
        }

        totalFare = baseFare + distanceFare + weightFare;
    } else {
        console.log("Invalid Travel Mode! Please enter 'train', 'car', or 'airplane'.");
        return "Error: Invalid Travel Mode";
    }

    console.log(`Weight Fare: ${weightFare} rupees`);
    console.log(`Distance Fare: ${distanceFare} rupees`);

    // let totalFare = distanceFare + weightFare;
    console.log(`Total Fare Before Extra Charges: ${totalFare} rupees`);

    let senderTotalPay = (totalFare + TE) * (1 + margin);
    console.log(`Final Amount (Sender Pays): ${senderTotalPay.toFixed(2)} rupees`);

    return {senderTotalPay: senderTotalPay.toFixed(2), totalFare: totalFare.toFixed(2)};
};


module.exports.calculateFarewithoutweight = async (distance, TravelMode) => {
    let travelMode = TravelMode.toLowerCase();

    console.log(`Travel Mode: ${travelMode}`);
    console.log(`Distance: ${distance} km`);

    // Validate distance input
    if (isNaN(distance) || distance <= 0) {
        console.log("Invalid distance value:", distance);
        return { error: "Invalid distance value" };
    }

    // Fetch fare configuration from DB
    let fareConfig = await FareConfig.findOne();
    if (!fareConfig) {
        console.log("Fare configuration not found in database. Creating default configuration...");
        // Create default fare configuration
        fareConfig = await FareConfig.create({
            TE: 112,
            deliveryFee: 0,
            margin: 0.2,
            weightRateTrain: 100,
            weightRateAirplane: 200,
            distanceRateTrain: 0.6,
            distanceRateAirplane: 0.2,
            baseFareTrain: 50,
            baseFareAirplane: 100
        });
        console.log("Default fare configuration created:", fareConfig);
    }

    console.log(fareConfig);

    let distanceFare = 0;
    let totalFare = 0;

    if (travelMode === "train" || travelMode === "car") {
        console.log(fareConfig.baseFareTrain)
        let baseFare = fareConfig.baseFareTrain;
        console.log("Base Fare:", baseFare);

        if(distance > 200){
            const distanceSlabs = Math.ceil((distance - 200)/300);
            distanceFare = distanceSlabs*fareConfig.distanceRateTrain;
        }
        console.log("Distance Fare:", distanceFare);
        totalFare = baseFare + distanceFare;
    } else if (travelMode === "airplane") {
        let baseFare = fareConfig.baseFareAirplane;

        if(distance > 500){
            const distanceSlabs = Math.ceil((distance - 500)/500);
            distanceFare = distanceSlabs*fareConfig.distanceRateAirplane;
        }

        totalFare = baseFare + distanceFare;
    } else {
        console.log("Invalid Travel Mode! Please enter 'train', 'car' or 'airplane'.");
        return { error: "Invalid Travel Mode" };
    }

    console.log(`Distance Fare: ${distanceFare} rupees`);
    console.log(`Total Fare: ${totalFare} rupees`);
    
    const result = totalFare.toFixed(2);
    console.log(`Returning fare: ${result}`);
    return result;
};


// module.exports.calculateFarewithoutweight = (distance, TravelMode) => {

//     let distanceFare = 0;
//     let TE = 112;
//     let deliveryFee = 0;
//     let discount = 0;
//     let travelMode = TravelMode.toLowerCase();

//     console.log(`Travel Mode: ${travelMode}`);
//     console.log(`Distance: ${distance} km`);

//     if (travelMode === "train" || travelMode === "car") {
//         if (distance > 0 && distance <= 100) {
//             distanceFare = distance * 0.6;
//         } else if (distance > 100 && distance <= 500) {
//             distanceFare = 60 + (distance - 100) * 0.1;
//         } else if (distance > 500) {
//             distanceFare = 100 + (distance - 500) * 0.1;
//         }
//     } else if (travelMode === "airplane") {
//         distanceFare = distance * 0.2;
//     } else {
//         console.log("Invalid Travel Mode! Please enter 'train', 'car' or 'airplane'.");
//         return {
//             error: "Invalid Travel Mode"
//         };
//     }

//     console.log(`Distance Fare: ${distanceFare} rupees`);

//     // You can apply a discount logic here, for example:
//     if (distance > 300) {
//         discount = 0.05 * (distanceFare + TE); // 5% discount
//         console.log(`Applied Discount: ${discount.toFixed(2)} rupees`);
//     }

//     let subtotal = distanceFare + TE + deliveryFee;
//     let totalWithMargin = (subtotal - discount) * 1.2; // Add 20% margin after discount

//     const result = {
//         senderTotalPay: totalWithMargin.toFixed(2),
//         TE: TE.toFixed(2),
//         deliveryFee: deliveryFee.toFixed(2),
//         discount: discount.toFixed(2),
//         baseFare: distanceFare.toFixed(2)
//     };

//     console.log("Fare Breakdown:", result);
//     return result;
// };




// let fair=this.calculateFarewithoutweight(100,"airplane");
// console.log(fair);