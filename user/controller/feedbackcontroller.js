const Feedback = require('../model/feedback');

// Submit feedback
exports.submitFeedback = async (req, res) => {
  try {
    const {phoneNumber, subject, feedbackmessage } = req.body;

    // Create and save the new feedback
    const newFeedback = new Feedback({phoneNumber, feedbackmessage, subject });
    await newFeedback.save();

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting feedback', error: error.message });
  }
};

// Get all feedback
exports.getAllFeedback = async (req, res) => {
  const {phoneNumber}=req.params;
  try {
    // Retrieve all feedback
    const phone=await Feedback.findOne({phoneNumber});
    if (!phone) {
      return res.status(404).json({ message: 'No feedback found' });
      }
    const feedback = await Feedback.find(); // No populate required
    res.status(200).json(feedback);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving feedback', error: error.message });
  }
};
