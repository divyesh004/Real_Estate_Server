const Lead = require('../models/Lead');
const mistralService = require('../services/mistralService');

// Helper function to extract user information from messages
const extractUserInfo = (message) => {
  const info = {};
  
  // Extract name (simple pattern matching)
  const nameMatch = message.match(/(?:my name is|i am|i'm) ([a-z\s]+)/i);
  if (nameMatch && nameMatch[1]) {
    info.name = nameMatch[1].trim();
  }
  
  // Extract budget
  const budgetMatch = message.match(/(?:budget|afford|looking for|range|price) [^\d]*(\d+[\d,.]*)/i);
  if (budgetMatch && budgetMatch[1]) {
    info.budget = budgetMatch[1].trim();
  }
  
  // Extract location
  const locationMatch = message.match(/(?:location|area|place|interested in) ([a-z\s,]+)/i);
  if (locationMatch && locationMatch[1]) {
    info.preferredLocation = locationMatch[1].trim();
  }
  
  // Extract property type
  const propertyTypes = ['apartment', 'house', 'condo', 'villa', 'flat', 'studio', 'penthouse', 'duplex'];
  for (const type of propertyTypes) {
    if (message.toLowerCase().includes(type)) {
      info.propertyType = type;
      break;
    }
  }
  
  return info;
};

// Legacy response generator (fallback if AI service fails)
const generateTemplateResponse = (message, leadInfo) => {
  // Greeting patterns
  if (message.match(/^(hi|hello|hey|greetings)/i)) {
    return leadInfo.name 
      ? `Hello ${leadInfo.name}! How can I help you with your real estate search today?` 
      : "Hello! I'm your real estate assistant. May I know your name?";
  }
  
  // If we don't have the user's name yet
  if (!leadInfo.name && message.length > 3) {
    const nameMatch = message.match(/(?:my name is|i am|i'm) ([a-z\s]+)/i);
    if (nameMatch && nameMatch[1]) {
      return `Nice to meet you, ${nameMatch[1].trim()}! What kind of property are you looking for?`;
    } else {
      return "Thanks for your message! May I know your name so I can better assist you?";
    }
  }
  
  // If we have the name but not property type
  if (leadInfo.name && !leadInfo.propertyType) {
    const propertyTypes = ['apartment', 'house', 'condo', 'villa', 'flat', 'studio', 'penthouse', 'duplex'];
    for (const type of propertyTypes) {
      if (message.toLowerCase().includes(type)) {
        return `Great! I'll help you find a ${type}. Do you have a specific budget in mind?`;
      }
    }
    return "What type of property are you interested in? Apartment, house, condo?";
  }
  
  // If we have name and property type but not budget
  if (leadInfo.name && leadInfo.propertyType && !leadInfo.budget) {
    const budgetMatch = message.match(/(?:budget|afford|looking for|range|price) [^\d]*(\d+[\d,.]*)/i);
    if (budgetMatch && budgetMatch[1]) {
      return `Thank you! And do you have a preferred location or area in mind?`;
    }
    return `What's your budget range for the ${leadInfo.propertyType}?`;
  }
  
  // If we have name, property type, budget but not location
  if (leadInfo.name && leadInfo.propertyType && leadInfo.budget && !leadInfo.preferredLocation) {
    const locationMatch = message.match(/(?:location|area|place|interested in) ([a-z\s,]+)/i);
    if (locationMatch && locationMatch[1]) {
      return `Perfect! I'll look for ${leadInfo.propertyType} properties in ${locationMatch[1].trim()} within your budget. Is there anything specific you're looking for in the property?`;
    }
    return "Which area or location are you interested in?";
  }
  
  // If we have all the information
  if (leadInfo.name && leadInfo.propertyType && leadInfo.budget && leadInfo.preferredLocation) {
    return `Thank you for providing all the details, ${leadInfo.name}. I'll help you find ${leadInfo.propertyType} properties in ${leadInfo.preferredLocation} within your budget of ${leadInfo.budget}. A real estate agent will contact you soon with some great options. Is there anything else you'd like to know?`;
  }
  
  // Default response
  return "Thank you for your message. How else can I assist you with your property search?";
};

// Generate response using Mistral AI or fallback to template
async function generateResponse(message, leadInfo, messageHistory, uiSize) {
  try {
    // Add UI size information to the context if available
    const contextWithUiInfo = { ...leadInfo };
    if (uiSize) {
      contextWithUiInfo.uiInfo = {
        width: uiSize.width,
        height: uiSize.height,
        isNotionStyle: true
      };
    }
    
    // Add instruction to enforce one-question-at-a-time approach
    contextWithUiInfo.oneQuestionAtATime = true;
    
    // Use Mistral AI to generate response with enhanced context
    const response = await mistralService.generateResponse(message, contextWithUiInfo, messageHistory);
    
    // Format response in a Notion-like style if needed
    return formatNotionStyleResponse(response);
  } catch (error) {
    console.error('Error using Mistral AI, falling back to template responses:', error);
    // Fallback to template-based responses
    return generateTemplateResponse(message, leadInfo);
  }
}

// Format response in a Notion-like style
function formatNotionStyleResponse(response) {
  // Add proper line breaks for paragraph styling
  const withParagraphs = response.replace(/\n{2,}/g, '\n\n');
  
  // Enhance bullet points
  const withBullets = withParagraphs.replace(/^\s*-\s(.+)$/gm, '• $1');
  
  // Format headings (if any)
  const withHeadings = withBullets.replace(/^#+\s(.+)$/gm, (match, heading) => {
    return heading.toUpperCase();
  });
  
  // Ensure only one question is asked at a time
  // Look for multiple question marks and keep only the first question
  const questionMarks = withHeadings.match(/\?/g);
  if (questionMarks && questionMarks.length > 1) {
    // Find the position of the first question mark
    const firstQuestionEnd = withHeadings.indexOf('?') + 1;
    // Keep only the content up to the first question
    return withHeadings.substring(0, firstQuestionEnd);
  }
  
  return withHeadings;
}

// Process incoming chat message
exports.processMessage = async (req, res) => {
  try {
    const { message, userId, uiSize } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // Process UI size information for Notion-like styling
    if (uiSize) {
      console.log('UI Size received for Notion-style formatting:', uiSize);
      // Store UI size for response formatting
    }
    
    // Extract user information from message
    const extractedInfo = extractUserInfo(message);
    
    // Find or create lead
    let lead;
    try {
      if (userId) {
        lead = await Lead.findById(userId);
        if (!lead) {
          console.log('User ID provided but lead not found, creating new lead');
          lead = new Lead();
        }
      } else {
        lead = new Lead();
      }
    } catch (dbError) {
      console.error('Database error when finding/creating lead:', dbError);
      return res.status(503).json({ 
        success: false, 
        error: 'Database connection error', 
        message: 'Unable to connect to database. Please try again later.'
      });
    }
    
    // Update lead information with extracted data
    if (extractedInfo.name) lead.name = extractedInfo.name;
    if (extractedInfo.budget) lead.budget = extractedInfo.budget;
    if (extractedInfo.preferredLocation) lead.preferredLocation = extractedInfo.preferredLocation;
    if (extractedInfo.propertyType) lead.propertyType = extractedInfo.propertyType;
    
    // Add message to history
    lead.messageHistory.push({
      sender: 'user',
      message: message
    });
    
    // Generate bot response using Mistral AI with timeout handling
    let botResponse;
    try {
      // Set a timeout for the response generation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Response generation timed out')), 15000); // 15 second timeout
      });
      
      // Race between the actual response and the timeout
      botResponse = await Promise.race([
        generateResponse(message, lead, lead.messageHistory, uiSize),
        timeoutPromise
      ]);
    } catch (aiError) {
      console.error('Error or timeout generating AI response:', aiError);
      // Use template response as fallback
      botResponse = generateTemplateResponse(message, lead);
    }
    
    // Add bot response to history
    lead.messageHistory.push({
      sender: 'bot',
      message: botResponse
    });
    
    // Save lead with error handling
    try {
      await lead.save();
    } catch (saveError) {
      console.error('Error saving lead to database:', saveError);
      // Still return a response to user even if save fails
      return res.status(200).json({
        success: true,
        response: botResponse,
        userId: lead._id,
        warning: 'Your conversation history may not be saved'
      });
    }
    
    // Return successful response
    return res.status(200).json({
      success: true,
      response: botResponse,
      userId: lead._id
    });
    
  } catch (error) {
    console.error('Error processing message:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error',
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
};

// Get chat history for a lead
exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    const lead = await Lead.findById(userId);
    
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    
    return res.status(200).json({
      success: true,
      history: lead.messageHistory
    });
    
  } catch (error) {
    console.error('Error getting chat history:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};