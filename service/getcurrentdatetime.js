module.exports. getCurrentDateTime=()=> {
    const now = new Date();
    return {
      date: now.toISOString().split("T")[0], 
      time: now.toTimeString().split(" ")[0], 
      day: now.toLocaleDateString("en-US", { weekday: "long" }) 
    };
  }