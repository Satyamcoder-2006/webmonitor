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

async function monitorWebsite(websiteId: number, isDashboardInitiated: boolean = false) {
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
    
    let shouldSendAlert = false;
    let alertType = '';
    let message = '';
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes cooldown

    const lastStatusInDb = website.lastStatus || 'unknown'; // Use website object directly
    const lastEmailSentInDb = website.lastEmailSent;

    // Condition 1: Website goes from UP to DOWN (Initial Downtime Alert)
    if (result.status === 'down' && lastStatusInDb === 'up') {
      shouldSendAlert = true;
      alertType = 'down';
      message = `${website.name} is now offline`;
      if (result.errorMessage) {
        message += ` (${result.errorMessage})`;
      }
    }
    // Condition 2: Website goes from DOWN to UP (Recovery Alert)
    else if (result.status === 'up' && lastStatusInDb === 'down') {
      shouldSendAlert = true;
      alertType = 'up';
      message = `${website.name} is back online`;
    }
    // Condition 3: Website is DOWN AND dashboard initiated AND cooldown passed (Reminder Alert)
    else if (result.status === 'down' && isDashboardInitiated && (!lastEmailSentInDb || lastEmailSentInDb < fifteenMinutesAgo)) {
        shouldSendAlert = true;
        alertType = 'reminder_down'; // A new type for dashboard-initiated reminders
        message = `${website.name} is currently offline (checked on dashboard)`;
        if (result.errorMessage) {
            message += ` (${result.errorMessage})`;
        }
    }

    if (shouldSendAlert) {
      // Create alert record
      await storage.createAlert({
        websiteId: website.id,
        alertType,
        message,
        emailSent: true, // Mark as true since we are sending it now
      });

      const emailSent = await sendAlert(website.email, {
        websiteName: website.name,
        websiteUrl: website.url,
        status: result.status,
        message,
        timestamp: now,
        responseTime: result.responseTime,
        errorMessage: result.errorMessage,
      });

      if (emailSent) {
        console.log(`Alert email sent for ${website.name} (Type: ${alertType})`);
        // Update lastEmailSent for DOWN or REMINDER alerts
        if (alertType === 'down' || alertType === 'reminder_down') {
            await storage.updateWebsite(website.id, {
                lastEmailSent: now,
            });
        }
      }
    }

    // Always update lastStatus after the check
    if (lastStatusInDb !== result.status) {
        await storage.updateWebsite(website.id, {
            lastStatus: result.status,
        });
    }
    
    console.log(`${website.name}: ${result.status} (${result.responseTime || 'N/A'}ms)`);
  } catch (error) {
    console.error(`Error monitoring website ${websiteId}:`, error);
  }
}

async function runMonitoringCycle(isDashboardInitiated: boolean = false) {
  try {
    const activeWebsites = await storage.getActiveWebsites();
    
    if (activeWebsites.length === 0) return;
    
    // Monitor all websites in parallel with minimal delay for real-time monitoring
    const promises = activeWebsites.map((website, index) => {
      // Small stagger to avoid overwhelming servers
      return new Promise<void>(resolve => {
        setTimeout(() => {
          monitorWebsite(website.id, isDashboardInitiated).catch(error => {
            console.error(`Error monitoring website ${website.id}:`, error);
          }).finally(() => resolve());
        }, index * 100); // 100ms stagger between websites
      });
    });
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error in monitoring cycle:', error);
  }
}

// Start the monitoring system
export function startMonitoring() {
  console.log('Starting website monitoring system...');
  
  // Run every second for real-time monitoring
  setInterval(() => {
    runMonitoringCycle(); // No argument for automatic checks
  }, 1000);
  
  // Run initial check immediately
  setTimeout(() => {
    runMonitoringCycle(); // No argument for initial automatic check
  }, 2000);
  
  console.log('Monitoring system started - checking every second');
}

// Export for manual testing
export { checkWebsite, monitorWebsite, runMonitoringCycle };
