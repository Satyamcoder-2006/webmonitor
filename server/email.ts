import * as nodemailer from 'nodemailer';

interface AlertData {
  websiteName: string;
  websiteUrl: string;
  status: 'up' | 'down' | 'error' | 'added' | 'deleted';
  message: string;
  timestamp: Date;
  responseTime?: number;
  errorMessage?: string;
}

// Create transporter (will use environment variables)
function createTransporter() {
  // Check for SMTP configuration
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Gmail configuration (uses SMTP)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use app password for Gmail
      },
    });
  }
  
  // Return null if no email configuration is found
  return null;
}

function generateEmailHTML(alertData: AlertData): string {
  let statusColor = '#4CAF50';
  let statusText = 'ONLINE';
  
  switch (alertData.status) {
    case 'up':
      statusColor = '#4CAF50';
      statusText = 'ONLINE';
      break;
    case 'down':
      statusColor = '#F44336';
      statusText = 'OFFLINE';
      break;
    case 'error':
      statusColor = '#FF9800';
      statusText = 'ERROR';
      break;
    case 'added':
      statusColor = '#2196F3';
      statusText = 'ADDED';
      break;
    case 'deleted':
      statusColor = '#9C27B0';
      statusText = 'DELETED';
      break;
  }
  
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
    const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_USER || 'noreply@webmonitor.app';
    let subject = `[WebMonitor] ${alertData.websiteName} is ${alertData.status === 'up' ? 'back online' : 'offline'}`;

    switch (alertData.status) {
      case 'down':
        subject = `🚨 Site Down Alert: ${alertData.websiteName} (${alertData.websiteUrl})`;
        break;
      case 'up':
        subject = `✅ Site Up: ${alertData.websiteName} (${alertData.websiteUrl})`;
        break;
      case 'error':
        subject = `⚠️ Site Error: ${alertData.websiteName} (${alertData.websiteUrl})`;
        break;
      case 'added':
        subject = `➕ Website Added: ${alertData.websiteName} (${alertData.websiteUrl})`;
        break;
      case 'deleted':
        subject = `🗑️ Website Removed: ${alertData.websiteName} (${alertData.websiteUrl})`;
        break;
    }

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

