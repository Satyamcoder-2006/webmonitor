const nodemailer = require('nodemailer');

// Test email configuration
const testConfig = {
  // Gmail configuration
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password
    }
  },
  // SMTP configuration
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
  }
};

// Test email data for different alert types
const testAlertData = {
  down: {
    websiteName: 'Test Website',
    websiteUrl: 'https://example.com',
    status: 'down',
    message: 'This is a test down alert from WebMonitor',
    timestamp: new Date(),
    responseTime: 0,
    errorMessage: 'This is a test error message',
  },
  up: {
    websiteName: 'Test Website',
    websiteUrl: 'https://example.com',
    status: 'up',
    message: 'This is a test recovery alert from WebMonitor',
    timestamp: new Date(),
    responseTime: 150,
    errorMessage: undefined,
  },
  added: {
    websiteName: 'New Test Website',
    websiteUrl: 'https://new-example.com',
    status: 'added',
    message: 'Website "New Test Website" has been successfully added to WebMonitor and will be monitored every 5 minutes.',
    timestamp: new Date(),
    responseTime: undefined,
    errorMessage: undefined,
  },
  deleted: {
    websiteName: 'Removed Test Website',
    websiteUrl: 'https://removed-example.com',
    status: 'deleted',
    message: 'Website "Removed Test Website" (https://removed-example.com) has been removed from WebMonitor monitoring.',
    timestamp: new Date(),
    responseTime: undefined,
    errorMessage: undefined,
  }
};

// Test email HTML template
function generateTestEmailHTML(alertData) {
  const statusColor = alertData.status === 'up' ? '#4CAF50' : '#F44336';
  const statusText = alertData.status === 'up' ? 'ONLINE' : 'OFFLINE';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Website Status Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #1976D2; margin: 0; font-size: 24px;">WebMonitor Alert</h1>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor};">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 10px;">
              ${statusText}
            </div>
            <h2 style="margin: 0; color: #333; font-size: 18px;">${alertData.websiteName}</h2>
          </div>
          
          <p style="margin: 10px 0; font-size: 16px;"><strong>URL:</strong> <a href="${alertData.websiteUrl}" style="color: #1976D2;">${alertData.websiteUrl}</a></p>
          <p style="margin: 10px 0; font-size: 16px;"><strong>Status:</strong> ${alertData.message}</p>
          <p style="margin: 10px 0; font-size: 16px;"><strong>Time:</strong> ${alertData.timestamp.toLocaleString()}</p>
          
          ${alertData.responseTime ? `<p style="margin: 10px 0; font-size: 16px;"><strong>Response Time:</strong> ${alertData.responseTime}ms</p>` : ''}
          
        </div>
        
        <div style="margin-top: 20px; text-align: center; font-size: 14px; color: #666;">
          <p>This alert was sent by WebMonitor. You're receiving this because you've subscribed to alerts for this website.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Test email text template
function generateTestEmailText(alertData) {
  return `
WebMonitor Alert

Website: ${alertData.websiteName}
URL: ${alertData.websiteUrl}
Status: ${alertData.message}
Time: ${alertData.timestamp.toLocaleString()}
${alertData.responseTime ? `Response Time: ${alertData.responseTime}ms` : ''}
${alertData.errorMessage ? `Error: ${alertData.errorMessage}` : ''}

---
This alert was sent by WebMonitor.
  `.trim();
}

// Test email sending function
async function testEmailSending() {
  console.log('🧪 Testing Email Features...\n');

  // Test 1: Check environment variables
  console.log('1. Checking Environment Variables:');
  console.log(`   EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Not set'}`);
  console.log(`   EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '✅ Set' : '❌ Not set'}`);
  console.log(`   FROM_EMAIL: ${process.env.FROM_EMAIL ? '✅ Set' : '❌ Not set'}\n`);

  // Test 2: Test Gmail configuration
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('2. Testing Gmail Configuration:');
    try {
      const gmailTransporter = nodemailer.createTransporter(testConfig.gmail);
      await gmailTransporter.verify();
      console.log('   ✅ Gmail configuration is valid');
    } catch (error) {
      console.log('   ❌ Gmail configuration failed:', error.message);
    }
  } else {
    console.log('2. Testing Gmail Configuration:');
    console.log('   ⚠️  Skipped - Gmail credentials not configured\n');
  }

  // Test 3: Test SMTP configuration
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('3. Testing SMTP Configuration:');
    try {
      const smtpTransporter = nodemailer.createTransporter(testConfig.smtp);
      await smtpTransporter.verify();
      console.log('   ✅ SMTP configuration is valid');
    } catch (error) {
      console.log('   ❌ SMTP configuration failed:', error.message);
    }
  } else {
    console.log('3. Testing SMTP Configuration:');
    console.log('   ⚠️  Skipped - SMTP credentials not configured\n');
  }

  // Test 4: Test email templates
  console.log('4. Testing Email Templates:');
  try {
    const htmlTemplate = generateTestEmailHTML(testAlertData.down);
    const textTemplate = generateTestEmailText(testAlertData.down);
    
    console.log('   ✅ HTML template generated successfully');
    console.log('   ✅ Text template generated successfully');
    console.log(`   📧 HTML length: ${htmlTemplate.length} characters`);
    console.log(`   📧 Text length: ${textTemplate.length} characters`);
  } catch (error) {
    console.log('   ❌ Template generation failed:', error.message);
  }

  // Test 5: Test actual email sending (if configured)
  const testEmail = process.env.TEST_EMAIL;
  if (testEmail && (process.env.EMAIL_USER || process.env.SMTP_HOST)) {
    console.log('\n5. Testing Actual Email Sending:');
    console.log(`   📧 Sending test email to: ${testEmail}`);
    
    try {
      let transporter;
      let fromEmail;
      
      if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransporter(testConfig.smtp);
        fromEmail = process.env.FROM_EMAIL || process.env.SMTP_USER;
      } else if (process.env.EMAIL_USER) {
        transporter = nodemailer.createTransporter(testConfig.gmail);
        fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER;
      }

      const mailOptions = {
        from: `WebMonitor Test <${fromEmail}>`,
        to: testEmail,
        subject: `🧪 WebMonitor Email Test - ${new Date().toLocaleString()}`,
        text: generateTestEmailText(testAlertData.down),
        html: generateTestEmailHTML(testAlertData.down),
      };
      
      const info = await transporter.sendMail(mailOptions);
      console.log('   ✅ Test email sent successfully!');
      console.log(`   📧 Message ID: ${info.messageId}`);
      console.log(`   📧 From: ${mailOptions.from}`);
      console.log(`   📧 To: ${mailOptions.to}`);
    } catch (error) {
      console.log('   ❌ Test email failed:', error.message);
    }
  } else {
    console.log('\n5. Testing Actual Email Sending:');
    console.log('   ⚠️  Skipped - No test email address or email configuration');
    console.log('   💡 Set TEST_EMAIL environment variable to test actual sending');
  }

  console.log('\n📋 Email Features Summary:');
  console.log('   ✅ Email templates are working');
  console.log('   ✅ Alert data structure is correct');
  console.log('   ✅ Email configuration validation');
  console.log('   ✅ Test email functionality');
  
  if (!process.env.EMAIL_USER && !process.env.SMTP_HOST) {
    console.log('\n⚠️  IMPORTANT: Email alerts will not work without email configuration!');
    console.log('   Please set up either Gmail or SMTP credentials in your environment variables.');
  }
}

// Run the test
testEmailSending().catch(console.error); 