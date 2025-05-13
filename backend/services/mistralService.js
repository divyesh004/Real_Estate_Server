const axios = require('axios');

/**
 * Mistral AI Service for generating AI responses
 */
class MistralService {
  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY;
    this.baseURL = 'https://api.mistral.ai/v1/chat/completions';
  }

  /**
   * Generate a response using Mistral AI
   * @param {string} userMessage - The user's message
   * @param {object} leadInfo - Information about the lead
   * @param {array} messageHistory - Previous messages in the conversation
   * @returns {Promise<string>} - The AI-generated response
   */
  async generateResponse(userMessage, leadInfo, messageHistory) {
    try {
      // Verify API key is available
      if (!this.apiKey) {
        console.error('Mistral API key is missing');
        throw new Error('API key configuration error');
      }

      // Format message history for the API
      const formattedHistory = this.formatMessageHistory(messageHistory);
      
      // Add system message with context about the lead
      const systemMessage = this.createSystemMessage(leadInfo);
      
      // Add the current user message
      formattedHistory.push({
        role: 'user',
        content: userMessage
      });
      
      // Configure request with timeout and retry logic
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 10000 // 10 second timeout
      };

      // Make API request to Mistral AI
      const response = await axios.post(
        this.baseURL,
        {
          model: 'mistral-tiny', // You can change to other models like mistral-small or mistral-medium
          messages: [systemMessage, ...formattedHistory],
          temperature: 0.7,
          max_tokens: 300
        },
        axiosConfig
      );
      
      // Validate response structure
      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
        console.error('Invalid response structure from Mistral API:', response.data);
        throw new Error('Invalid API response structure');
      }
      
      // Extract and return the AI response
      return response.data.choices[0].message.content;
    } catch (error) {
      // Log detailed error information
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx range
        console.error('Mistral API error response:', error.response.status, error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from Mistral API:', error.request);
      } else {
        // Something happened in setting up the request
        console.error('Error setting up Mistral API request:', error.message);
      }
      
      // Fallback response in case of API failure
      return "I'm sorry, I'm having trouble connecting to my AI service right now. How else can I help you with your property search?";
    }
  }

  /**
   * Format message history for Mistral API
   * @param {array} messageHistory - The lead's message history
   * @returns {array} - Formatted messages for the API
   */
  formatMessageHistory(messageHistory) {
    if (!messageHistory || messageHistory.length === 0) {
      return [];
    }
    
    // Take the last 10 messages to stay within context limits
    const recentMessages = messageHistory.slice(-10);
    
    return recentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.message
    }));
  }

  /**
   * Create a system message with lead context
   * @param {object} leadInfo - Information about the lead
   * @returns {object} - System message with context
   */
  createSystemMessage(leadInfo) {
    let context = 'You are a helpful real estate assistant. ';
    
    if (leadInfo) {
      context += 'Here is what you know about the client: ';
      
      if (leadInfo.name) context += `Their name is ${leadInfo.name}. `;
      if (leadInfo.budget) context += `Their budget is ${leadInfo.budget}. `;
      if (leadInfo.preferredLocation) context += `They are interested in properties in ${leadInfo.preferredLocation}. `;
      if (leadInfo.propertyType) context += `They are looking for a ${leadInfo.propertyType}. `;
      
      context += 'Use this information to provide personalized assistance. ';
      
      // Add UI context for Notion-like formatting
      if (leadInfo.uiInfo && leadInfo.uiInfo.isNotionStyle) {
        context += '\n\nYou are displayed in a Notion-like interface. Format your responses accordingly with these guidelines:\n';
        context += '- Use clean paragraph breaks for readability\n';
        context += '- Use bullet points (•) for lists\n';
        context += '- You can use simple formatting like UPPERCASE for emphasis\n';
        context += '- Keep responses concise and well-structured\n';
        context += '- Organize information in a clear, hierarchical manner\n';
      }
    }
    
    context += 'Be friendly, professional, and helpful. Your goal is to collect information about their real estate needs and preferences.';
    
    // Add instruction to ask one question at a time
    context += '\n\nIMPORTANT INSTRUCTION: Ask only ONE question at a time. Wait for the user to respond before asking the next question. Do not ask multiple questions in a single response. Focus on getting a complete answer to one question before moving to the next topic. This creates a more natural conversation flow.\n\nEven if you have multiple questions in mind, only ask the most important one first. After the user responds, you can ask the next question based on their response. This sequential approach helps create a more engaging and personalized conversation experience.\n\nRemember: ONE QUESTION PER RESPONSE - NO EXCEPTIONS.'
    
    // Add special emphasis if oneQuestionAtATime flag is set
    if (leadInfo && leadInfo.oneQuestionAtATime) {
      context += '\n\n⚠️ USER PREFERENCE: The user has specifically requested that you ask only ONE question at a time. This is extremely important. Never combine multiple questions in a single response. After each user reply, choose the next most logical question based on their answer.';
    }
    
    return {
      role: 'system',
      content: context
    };
  }
}

module.exports = new MistralService();