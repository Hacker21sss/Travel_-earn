const Feedback = require('../model/feedback');

// Submit feedback
exports.submitFeedback = async (req, res) => {
  try {
    const { phoneNumber, subject, feedbackmessage } = req.body;

    // Validate and clean phone number
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const cleanedPhoneNumber = phoneNumber.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,}$/.test(cleanedPhoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Create and save the new feedback
    const newFeedback = new Feedback({ 
      phoneNumber: cleanedPhoneNumber, 
      feedbackmessage, 
      subject 
    });
    await newFeedback.save();

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting feedback', error: error.message });
  }
};

// Get all feedback
exports.getAllFeedback = async (req, res) => {
  const { phoneNumber } = req.params;
  try {
    // Validate and clean phone number
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const cleanedPhoneNumber = phoneNumber.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,}$/.test(cleanedPhoneNumber)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Retrieve feedback
    const phone = await Feedback.findOne({ phoneNumber: cleanedPhoneNumber });
    if (!phone) {
      return res.status(404).json({ message: 'No feedback found' });
    }
    const feedback = await Feedback.find();
    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving feedback', error: error.message });
  }
};
