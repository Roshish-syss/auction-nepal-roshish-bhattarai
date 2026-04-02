const axios = require('axios');

// SMS Service for Nepal
// Using a generic SMS API approach - you can integrate with:
// - Sparrow SMS (sparrowsms.com) - Popular in Nepal
// - SMS API providers that support Nepal
// - Or use a generic HTTP SMS gateway

exports.sendOTP = async (phoneNumber, otp) => {
  try {
    // Format phone number (add country code for Nepal: +977)
    const formattedPhone = phoneNumber.startsWith('977') 
      ? `+${phoneNumber}` 
      : phoneNumber.startsWith('+977')
      ? phoneNumber
      : `+977${phoneNumber}`;

    // SMS Service Configuration
    // Option 1: Using Sparrow SMS (if you have an account)
    // Uncomment and configure if using Sparrow SMS
    /*
    const sparrowConfig = {
      token: process.env.SPARROW_SMS_TOKEN,
      from: process.env.SPARROW_SMS_FROM || 'AuctionNepal',
      to: formattedPhone,
      text: `Your AuctionNepal verification code is: ${otp}. Valid for 5 minutes.`
    };

    const response = await axios.post('http://api.sparrowsms.com/v2/sms/', sparrowConfig);
    return { success: true, messageId: response.data.message_id };
    */

    // Option 2: Using generic SMS API (configure with your SMS provider)
    // For now, we'll log the OTP to console for development
    // Replace this with actual SMS API integration
    
    console.log(`[SMS] OTP for ${formattedPhone}: ${otp}`);
    console.log(`[SMS] Message: Your AuctionNepal verification code is: ${otp}. Valid for 5 minutes.`);
    
    // TODO: Replace with actual SMS API call
    // Example structure:
    /*
    const smsResponse = await axios.post('YOUR_SMS_API_ENDPOINT', {
      phone: formattedPhone,
      message: `Your AuctionNepal verification code is: ${otp}. Valid for 5 minutes.`,
      api_key: process.env.SMS_API_KEY
    });
    */

    // For development/testing, return success
    // In production, uncomment and use actual SMS service
    return { 
      success: true, 
      message: 'OTP sent successfully (logged to console for development)',
      otp: otp // Remove this in production - only for testing
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send SMS' 
    };
  }
};

// Send SMS notification (generic)
exports.sendSMS = async (phoneNumber, message) => {
  try {
    const formattedPhone = phoneNumber.startsWith('977') 
      ? `+${phoneNumber}` 
      : phoneNumber.startsWith('+977')
      ? phoneNumber
      : `+977${phoneNumber}`;

    console.log(`[SMS] To: ${formattedPhone}`);
    console.log(`[SMS] Message: ${message}`);

    // TODO: Integrate with actual SMS service
    return { success: true };
  } catch (error) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message };
  }
};

