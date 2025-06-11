import { storage } from "./storage";
import { sendAlert } from "./email";

interface MonitoringResult {
  status: 'up' | 'down' | 'error';
  httpStatus?: number;
  responseTime?: number;
  errorMessage?: string;
}

// Add WebSocket broadcast function
let broadcastUpdate: ((data: any) => void) | null = null;

export function setBroadcastFunction(fn: (data: any) => void) {
  broadcastUpdate = fn;
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
    
    if (!response.ok) {
      console.warn(`[checkWebsite] Website ${url} returned non-OK status: ${response.status}`);
    }

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
    console.error(`[checkWebsite] Error checking ${url}:`, error);
    
    return {
      status: 'down',
      responseTime: responseTime > 30000 ? undefined : responseTime,
      errorMessage,
    };
  }
}

async function monitorWebsite(websiteId: number): Promise<MonitoringResult | null> {
  try {
    const website = await storage.getWebsite(websiteId);
    if (!website || !website.isActive) {
      return null;
    }
    
    console.log(`Checking ${website.name} (${website.url})`);
    
    const result = await checkWebsite(website.url);
    const now = new Date();
    
    // Log the result
    await storage.createMonitoringLog({
      websiteId: website.id,
      status: result.status,
      httpStatus: result.httpStatus || null,
      responseTime: result.responseTime || null,
      errorMessage: result.errorMessage || null,
    });
    
    let shouldSendAlert = false;
    let message = '';
    const lastStatus = website.lastStatus || 'unknown';

    // Only send alert if the status has actually changed
    if (result.status !== lastStatus) {
      shouldSendAlert = true;
      message = result.status === 'up' 
        ? `${website.name} is back online`
        : `${website.name} is offline`;
    }

    if (shouldSendAlert) {
      if (result.errorMessage) {
        message += ` (${result.errorMessage})`;
      }

      // Send alert immediately
      await sendAlert(website.email, {
        websiteName: website.name,
        websiteUrl: website.url,
        status: result.status,
        message,
        timestamp: now,
        responseTime: result.responseTime,
        errorMessage: result.errorMessage,
      });

      // Update lastAlertSent timestamp (only on actual alert send)
      await storage.updateWebsite(website.id, {
        lastAlertSent: now,
      });
    }

    // Always update lastStatus, even if no alert was sent
    if (lastStatus !== result.status) {
      await storage.updateWebsite(website.id, {
        lastStatus: result.status,
      });
    }
    
    // Broadcast the update through WebSocket
    if (broadcastUpdate) {
      const updateData = {
        type: 'status_update',
        websiteId: website.id,
        status: result.status,
        responseTime: result.responseTime,
        timestamp: now.toISOString()
      };
      broadcastUpdate(updateData);
      console.log(`[WebSocket] Broadcasting update for ${website.name}: ${result.status}`);
    }
    
    console.log(`${website.name}: ${result.status} (${result.responseTime || 'N/A'}ms)`);
    return result;
  } catch (error) {
    console.error(`Error monitoring website ${websiteId}:`, error);
    return null;
  }
}

async function runMonitoringCycle() {
  try {
    const activeWebsites = await storage.getActiveWebsites();
    
    if (activeWebsites.length === 0) return;
    
    // Monitor all websites in parallel with minimal delay
    const promises = activeWebsites.map((website, index) => {
      return new Promise<void>(resolve => {
        setTimeout(() => {
          monitorWebsite(website.id).catch(error => {
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
  
  // Run every 5 seconds for regular checks
  setInterval(() => {
    runMonitoringCycle();
  }, 5000);
  
  // Run initial check immediately
  setTimeout(() => {
    runMonitoringCycle();
  }, 2000);
  
  console.log('Monitoring system started - checking every 5 seconds');
}

// Export for manual testing
export { checkWebsite, monitorWebsite, runMonitoringCycle };
