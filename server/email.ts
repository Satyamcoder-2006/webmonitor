import * as nodemailer from 'nodemailer';

interface AlertData {
  websiteName: string;
  websiteUrl: string;
  status: 'up' | 'down' | 'error';
  message: string;
  timestamp: Date;
  responseTime?: number;
  errorMessage?: string;
}

// Create transporter (will use environment variables)
function createTransporter() {
  // Check for different email service configurations
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Gmail configuration
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // Use app password for Gmail
      },
    });
  }
  
  // SendGrid configuration
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransporter({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  
  // Fallback to console logging if no email service is configured
  return null;
}

function generateEmailHTML(alertData: AlertData): string {
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
          ${alertData.errorMessage ? `<p style="margin: 10px 0; font-size: 16px;"><strong>Error:</strong> ${alertData.errorMessage}</p>` : ''}
        </div>
        
        <div style="margin-top: 20px; text-align: center; font-size: 14px; color: #666;">
          <p>This alert was sent by WebMonitor. You're receiving this because you've subscribed to alerts for this website.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateEmailText(alertData: AlertData): string {
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

export async function sendAlert(to: string, alertData: AlertData): Promise<boolean> {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('No email service configured. Alert would be sent to:', to);
    console.log('Alert details:', alertData);
    return false;
  }
  
  try {
    const fromEmail = process.env.FROM_EMAIL || process.env.GMAIL_USER || process.env.SMTP_USER || 'noreply@webmonitor.app';
    const subject = `[WebMonitor] ${alertData.websiteName} is ${alertData.status === 'up' ? 'back online' : 'offline'}`;
    
    const mailOptions = {
      from: `WebMonitor <${fromEmail}>`,
      to,
      subject,
      text: generateEmailText(alertData),
      html: generateEmailHTML(alertData),
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Alert email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send alert email:', error);
    return false;
  }
}

// Test email function
export async function sendTestEmail(to: string): Promise<boolean> {
  return sendAlert(to, {
    websiteName: 'Test Website',
    websiteUrl: 'https://example.com',
    status: 'down',
    message: 'This is a test alert from WebMonitor',
    timestamp: new Date(),
    responseTime: 0,
    errorMessage: 'This is a test error message',
  });
}
