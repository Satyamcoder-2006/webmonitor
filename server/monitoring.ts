import { storage } from "./storage";
import { sendAlert } from "./email";
import * as cron from "node-cron";

interface MonitoringResult {
  status: 'up' | 'down' | 'error';
  httpStatus?: number;
  responseTime?: number;
  errorMessage?: string;
}

async function checkWebsite(url: string): Promise<MonitoringResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'WebMonitor/1.0 (+https://webmonitor.app)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.ok ? 'up' : 'down',
      httpStatus: response.status,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Domain not found';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      status: 'down',
      responseTime: responseTime > 30000 ? undefined : responseTime,
      errorMessage,
    };
  }
}

async function monitorWebsite(websiteId: number, isManualCheck = false) {
  try {
    const website = await storage.getWebsite(websiteId);
    if (!website || !website.isActive) {
      return;
    }
    
    console.log(`Checking ${website.name} (${website.url})`);
    
    const result = await checkWebsite(website.url);
    
    // Log the result
    await storage.createMonitoringLog({
      websiteId: website.id,
      status: result.status,
      httpStatus: result.httpStatus || null,
      responseTime: result.responseTime || null,
      errorMessage: result.errorMessage || null,
    });
    
    // Get the previous status to detect changes
    const recentLogs = await storage.getMonitoringLogs(website.id, 2);
    const previousStatus = recentLogs.length > 1 ? recentLogs[1].status : null;
    
    let shouldSendAlert = false;
    let alertType = '';
    let message = '';
    
    // Send alerts for status changes (automatic monitoring)
    if (result.status !== previousStatus) {
      shouldSendAlert = true;
      
      if (result.status === 'down' && previousStatus === 'up') {
        alertType = 'down';
        message = `${website.name} is now offline`;
        if (result.errorMessage) {
          message += ` (${result.errorMessage})`;
        }
      } else if (result.status === 'up' && (previousStatus === 'down' || previousStatus === 'error')) {
        alertType = 'up';
        message = `${website.name} is back online`;
      } else {
        shouldSendAlert = false;
      }
    }
    
    // Send alert for manual checks when website is down
    if (isManualCheck && result.status === 'down') {
      shouldSendAlert = true;
      alertType = 'manual_check';
      message = `Manual check: ${website.name} is offline`;
      if (result.errorMessage) {
        message += ` (${result.errorMessage})`;
      }
    }
    
    if (shouldSendAlert) {
      // Create alert record
      const alert = await storage.createAlert({
        websiteId: website.id,
        alertType,
        message,
        emailSent: false,
      });
      
      // Send email notification
      try {
        const emailSent = await sendAlert(website.email, {
          websiteName: website.name,
          websiteUrl: website.url,
          status: result.status,
          message,
          timestamp: new Date(),
          responseTime: result.responseTime,
          errorMessage: result.errorMessage,
        });
        
        if (emailSent) {
          console.log(`Alert email sent for ${website.name}`);
        }
      } catch (emailError) {
        console.error(`Failed to send email alert for ${website.name}:`, emailError);
      }
    }
    
    console.log(`${website.name}: ${result.status} (${result.responseTime || 'N/A'}ms)`);
  } catch (error) {
    console.error(`Error monitoring website ${websiteId}:`, error);
  }
}

async function runMonitoringCycle() {
  try {
    const activeWebsites = await storage.getActiveWebsites();
    console.log(`Running monitoring cycle for ${activeWebsites.length} websites`);
    
    // Monitor all websites in parallel with some delay to avoid overwhelming
    for (let i = 0; i < activeWebsites.length; i++) {
      const website = activeWebsites[i];
      
      // Add small delay between requests to be respectful
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Don't await - let them run in parallel but with staggered starts
      monitorWebsite(website.id).catch(error => {
        console.error(`Error in monitoring cycle for website ${website.id}:`, error);
      });
    }
  } catch (error) {
    console.error('Error in monitoring cycle:', error);
  }
}

// Start the monitoring system
export function startMonitoring() {
  console.log('Starting website monitoring system...');
  
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    runMonitoringCycle();
  });
  
  // Run initial check after 30 seconds
  setTimeout(() => {
    runMonitoringCycle();
  }, 30000);
  
  console.log('Monitoring system started - checking every 5 minutes');
}

// Export for manual testing
export { checkWebsite, monitorWebsite, runMonitoringCycle };
