const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  budget: {
    type: String,
    trim: true
  },
  preferredLocation: {
    type: String,
    trim: true
  },
  propertyType: {
    type: String,
    trim: true
  },
  messageHistory: [
    {
      sender: String, // 'user' or 'bot'
      message: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Lead', LeadSchema);