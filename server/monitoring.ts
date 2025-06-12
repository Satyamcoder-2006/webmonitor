import { storage } from "./storage";
import { sendAlert } from "./email";
import { Website } from "@shared/schema";
import * as https from 'https';
import * as tls from 'tls';
import { URL } from 'url';

interface MonitoringResult {
  status: 'up' | 'down' | 'error';
  httpStatus?: number;
  responseTime?: number;
  errorMessage?: string;
  sslValid: boolean | null;
  sslExpiryDate?: Date | null;
  sslDaysLeft?: number | null;
}

interface SSLCertificateInfo {
  valid: boolean;
  expiryDate?: Date;
  daysLeft?: number;
  errorMessage?: string;
}

// Add WebSocket broadcast function
let broadcastUpdate: ((data: any) => void) | null = null;

export function setBroadcastFunction(fn: (data: any) => void) {
  broadcastUpdate = fn;
}

// Function to check SSL certificate
async function checkSSLCertificate(url: string): Promise<SSLCertificateInfo> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        host: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        method: 'GET',
        path: parsedUrl.pathname,
        rejectUnauthorized: false, // We want to check even invalid certs
        timeout: 10000, // 10 second timeout
        agent: new https.Agent({
          keepAlive: true, // Enable keepAlive for better performance
          rejectUnauthorized: false,
          // Use a small timeout to force new handshakes periodically
          sessionTimeout: 1000,
          maxCachedSessions: 1
        })
      };

      const req = https.request(options, (res) => {
        const cert = res.socket as tls.TLSSocket;
        
        // Get certificate information using multiple methods
        const peerCert = cert.getPeerCertificate(true) as tls.DetailedPeerCertificate;
        const socketCert = cert.getPeerCertificate(true) as tls.DetailedPeerCertificate;
        
        // Try to get certificate info from the socket first
        let certInfo = socketCert;
        
        // If socket cert is empty, try peer cert
        if (Object.keys(socketCert).length === 0) {
          certInfo = peerCert;
        }
        
        // If both are empty, try getting raw cert
        if (Object.keys(certInfo).length === 0) {
          const rawCert = cert.getPeerCertificate() as tls.PeerCertificate;
          if (Object.keys(rawCert).length > 0) {
            certInfo = rawCert as tls.DetailedPeerCertificate;
          }
        }

        // If we still don't have certificate info, try one more time with a new request
        if (Object.keys(certInfo).length === 0) {
          console.log(`[SSL Check] Retrying certificate check for ${url} with new connection`);
          // Close this request and retry
          req.destroy();
          checkSSLCertificate(url).then(resolve).catch(err => {
            console.error(`[SSL Check] Retry failed for ${url}:`, err);
            resolve({ valid: false, errorMessage: err.message });
          });
          return;
        }

        // Log the certificate information
        console.log(`[SSL Check] Raw certificate data for ${url}:`, {
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          validFrom: certInfo.valid_from,
          validTo: certInfo.valid_to,
          serialNumber: certInfo.serialNumber,
          fingerprint: certInfo.fingerprint,
          authorized: cert.authorized,
          encrypted: cert.encrypted
        });

        // If we have a valid encrypted connection but no certificate info,
        // try to get it from the socket's secure context
        if (cert.encrypted && cert.authorized && Object.keys(certInfo).length === 0) {
          const secureContext = (cert as any)._handle?.secureContext;
          if (secureContext) {
            const ctxCert = secureContext.getCertificate() as tls.DetailedPeerCertificate;
            if (ctxCert) {
              certInfo = ctxCert;
              console.log(`[SSL Check] Retrieved certificate from secure context for ${url}`);
            }
          }
        }
        
        // Check if the connection is actually encrypted and authorized
        if (cert.encrypted && cert.authorized) {
          console.log(`[SSL Check] Connection is encrypted and authorized for ${url}`);
          const now = new Date();
          
          // Try to get the expiry date from the certificate
          let expiryDate: Date | undefined;
          let daysLeft: number | undefined;
          
          if (certInfo.valid_to) {
            expiryDate = new Date(certInfo.valid_to);
            daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`[SSL Check] Found certificate expiry date for ${url}:`, {
              expiryDate: expiryDate.toISOString(),
              daysLeft
            });
          } else {
            // If we can't get the expiry date from the certificate,
            // try to get it from the socket's secure context
            const secureContext = (cert as any)._handle?.secureContext;
            if (secureContext) {
              const ctxCert = secureContext.getCertificate() as tls.DetailedPeerCertificate;
              if (ctxCert && ctxCert.valid_to) {
                expiryDate = new Date(ctxCert.valid_to);
                daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                console.log(`[SSL Check] Found certificate expiry date from secure context for ${url}:`, {
                  expiryDate: expiryDate.toISOString(),
                  daysLeft
                });
              } else {
                console.log(`[SSL Check] Could not determine expiry date for ${url}, but connection is secure`);
              }
            } else {
              console.log(`[SSL Check] Could not determine expiry date for ${url}, but connection is secure`);
            }
          }
          
          resolve({
            valid: true,
            expiryDate,
            daysLeft,
            errorMessage: undefined
          });
          return;
        }
        
        if (Object.keys(certInfo).length === 0) {
          console.warn(`[SSL Check] No certificate presented for ${url}`);
          resolve({ valid: false, errorMessage: 'No SSL certificate presented' });
          return;
        }
        
        // Check if certificate is expired based on dates
        let valid = true;
        let errorMessage: string | undefined;
        
        if (certInfo.valid_to) {
          const expiryDate = new Date(certInfo.valid_to);
          const now = new Date();
          const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Certificate is valid if it hasn't expired
          valid = now < expiryDate;
          
          if (!valid) {
            errorMessage = 'Certificate has expired';
            console.warn(`[SSL Check] Certificate expired for ${url}`);
          }
          
          // Check for authorization errors
          if (cert.authorizationError) {
            // Log the error but don't necessarily mark as invalid
            console.warn(`[SSL Check] Authorization warning for ${url}:`, cert.authorizationError);
            
            // Only mark as invalid for serious errors, not just self-signed or common issues
            const authError = cert.authorizationError ? cert.authorizationError.toString().toLowerCase() : '';
            const commonIssues = [
              'self signed certificate',
              'self-signed certificate',
              'unable to verify the first certificate',
              'unable to get local issuer certificate',
              'certificate is not yet valid',
              'certificate has expired',
              'certificate chain',
              'unable to get issuer certificate'
            ];
            
            const isCommonIssue = commonIssues.some(issue => authError.includes(issue));
            
            if (!isCommonIssue) {
              valid = false;
              errorMessage = cert.authorizationError ? cert.authorizationError.toString() : 'Unknown authorization error';
              console.warn(`[SSL Check] Marking certificate as invalid for ${url} due to: ${errorMessage}`);
            } else {
              console.log(`[SSL Check] Ignoring common SSL warning for ${url}: ${cert.authorizationError}`);
              // For common issues, we'll consider the certificate valid if it's not expired
              valid = true;
            }
          }
          
          console.log(`[SSL Check] Final certificate status for ${url}:`, {
            valid,
            daysLeft,
            errorMessage: errorMessage || 'none',
            expiryDate: expiryDate.toISOString(),
            currentTime: now.toISOString()
          });
          
          resolve({
            valid,
            expiryDate,
            daysLeft,
            errorMessage
          });
        } else {
          // If we can't read the expiry date but the connection is encrypted, consider it valid
          if (cert.encrypted) {
            console.log(`[SSL Check] Connection is encrypted but no expiry date for ${url}, considering valid`);
            resolve({
              valid: true,
              expiryDate: undefined,
              daysLeft: undefined,
              errorMessage: undefined
            });
          } else {
            console.warn(`[SSL Check] Certificate missing expiration date for ${url}`);
            resolve({ 
              valid: false, 
              errorMessage: 'Certificate missing expiration date' 
            });
          }
        }
      });
      
      req.on('error', (err) => {
        console.error(`SSL check error for ${url}:`, err);
        resolve({ valid: false, errorMessage: err.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ valid: false, errorMessage: 'SSL check timed out' });
      });
      
      req.end();
    } catch (error) {
      console.error(`Error in SSL check for ${url}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      resolve({ valid: false, errorMessage });
    }
  });
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
    
    // Check SSL if it's an HTTPS URL
    let sslInfo: SSLCertificateInfo = { valid: false };
    if (url.startsWith('https://')) {
      try {
        sslInfo = await checkSSLCertificate(url);
      } catch (error) {
        console.error(`[checkWebsite] SSL check failed for ${url}:`, error);
        sslInfo = { 
          valid: false, 
          errorMessage: error instanceof Error ? error.message : 'SSL check failed'
        };
      }
    }
    
    if (!response.ok) {
      console.warn(`[checkWebsite] Website ${url} returned non-OK status: ${response.status}`);
    }

    return {
      status: response.ok ? 'up' : 'down',
      httpStatus: response.status,
      responseTime,
      sslValid: url.startsWith('https://') ? sslInfo.valid : null,
      sslExpiryDate: sslInfo.expiryDate,
      sslDaysLeft: sslInfo.daysLeft ?? null,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      const errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'Request timeout';
      } else if (errorMsg.includes('ENOTFOUND')) {
        errorMessage = 'Domain not found';
      } else if (errorMsg.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused';
      } else {
        errorMessage = errorMsg;
      }
    }
    console.error(`[checkWebsite] Error checking ${url}:`, error);
    
    // Only try to check SSL if it's HTTPS and we haven't already failed due to SSL issues
    let sslInfo: SSLCertificateInfo = { valid: false };
    if (url.startsWith('https://') && !errorMessage.toLowerCase().includes('ssl')) {
      try {
        sslInfo = await checkSSLCertificate(url);
      } catch (sslError) {
        console.error(`[checkWebsite] SSL check failed for ${url} after website check failed:`, sslError);
        sslInfo = { 
          valid: false, 
          errorMessage: sslError instanceof Error ? sslError.message : 'SSL check failed'
        };
      }
    }
    
    return {
      status: 'down',
      responseTime: responseTime > 30000 ? undefined : responseTime,
      errorMessage,
      sslValid: url.startsWith('https://') ? sslInfo.valid : null,
      sslExpiryDate: sslInfo.expiryDate,
      sslDaysLeft: sslInfo.daysLeft ?? null,
    };
  }
}

// Store monitoring intervals
const monitoringIntervals = new Map<number, NodeJS.Timeout>();

async function monitorWebsite(websiteId: number): Promise<MonitoringResult | undefined> {
  try {
    const website = await storage.getWebsite(websiteId);
    if (!website) {
      console.error(`[monitorWebsite] Website ${websiteId} not found`);
      return;
    }

    const result = await checkWebsite(website.url);
    const now = new Date();

    // Create monitoring log with SSL information
    await storage.createMonitoringLog({
      websiteId,
      status: result.status,
      httpStatus: result.httpStatus,
      responseTime: result.responseTime,
      errorMessage: result.errorMessage,
    });

    // Only update SSL information if it's an HTTPS URL and we have valid SSL data
    if (website.url.startsWith('https://') && result.sslValid !== null) {
      // Update website with status and SSL information
      await storage.updateWebsite(website.id, {
        lastStatus: result.status,
        sslValid: result.sslValid,
        sslExpiryDate: result.sslExpiryDate,
        sslDaysLeft: result.sslDaysLeft
      });
    } else {
      // Update only the status if it's not HTTPS or we don't have SSL data
      await storage.updateWebsite(website.id, {
        lastStatus: result.status
      });
    }

    // Broadcast the update to all connected clients
    if (broadcastUpdate) {
      broadcastUpdate({
        type: 'status_update',
        websiteId,
        status: result.status,
        responseTime: result.responseTime,
        timestamp: now.toISOString(),
        sslValid: result.sslValid,
        sslExpiryDate: result.sslExpiryDate,
        sslDaysLeft: result.sslDaysLeft
      });
    }

    // Check if we need to send an alert
    let shouldSendAlert = false;
    let message = '';

    const lastStatus = website.lastStatus || 'unknown';

    // Only send alert if the status has actually changed
    if (result.status !== lastStatus) {
      shouldSendAlert = true;
      message = result.status === 'up' 
        ? `Website ${website.name} is back up!`
        : `Website ${website.name} is down! ${result.errorMessage ? `Error: ${result.errorMessage}` : ''}`;
    }

    // Check if SSL certificate is expiring soon (30 days or less)
    if (result.sslValid === true && typeof result.sslDaysLeft === 'number' && result.sslDaysLeft <= 30) {
      shouldSendAlert = true;
      message = `SSL Certificate for ${website.name} is expiring in ${result.sslDaysLeft} days!`;
    }

    // Send alert if needed
    if (shouldSendAlert) {
      await sendAlert(website.email, {
        websiteName: website.name,
        websiteUrl: website.url,
        status: result.status,
        message,
        timestamp: now,
        responseTime: result.responseTime,
        errorMessage: result.errorMessage,
      });
    }
    
    console.log(`${website.name}: ${result.status} (${result.responseTime || 'N/A'}ms) | SSL: ${result.sslValid === true ? 'Valid' : result.sslValid === false ? 'Invalid' : 'N/A'} ${result.sslDaysLeft ? `(${result.sslDaysLeft} days left)` : ''}`);
    
    return result;
  } catch (error) {
    console.error(`Error monitoring website ${websiteId}:`, error);
    // Return a default error result
    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      sslValid: null
    };
  }
}

export async function runMonitoringCycle() {
  try {
    // This function is now only used for manual refresh
    const websites = await storage.getActiveWebsites();
    console.log(`Running monitoring cycle for ${websites.length} websites`);
    
    for (const website of websites) {
      await monitorWebsite(website.id);
    }
    
    console.log('Monitoring cycle completed');
  } catch (error) {
    console.error('Error running monitoring cycle:', error);
  }
}

// Function to schedule monitoring for a specific website
function scheduleWebsiteMonitoring(website: Website) {
  // Remove existing interval if it exists
  if (monitoringIntervals.has(website.id)) {
    clearInterval(monitoringIntervals.get(website.id));
    monitoringIntervals.delete(website.id);
  }
  
  // Only schedule if the website is active
  if (website.isActive) {
    // Convert check_interval from minutes to milliseconds
    const intervalMs = website.checkInterval * 60 * 1000;
    
    // Schedule the interval
    const interval = setInterval(() => {
      monitorWebsite(website.id).catch(error => {
        console.error(`Error monitoring website ${website.id}:`, error);
      });
    }, intervalMs);
    
    monitoringIntervals.set(website.id, interval);
    console.log(`Scheduled monitoring for ${website.name} every ${website.checkInterval} minutes`);
  }
}

// Function to initialize monitoring for all websites
export async function startMonitoring() {
  console.log('Starting website monitoring system...');
  
  // Get all active websites
  const websites = await storage.getActiveWebsites();
  
  // Schedule monitoring for each website
  for (const website of websites) {
    scheduleWebsiteMonitoring(website);
  }
  
  // Run initial check immediately
  setTimeout(() => {
    runMonitoringCycle();
  }, 2000);
  
  console.log('Monitoring system started with individual website intervals');
}

// Function to update monitoring schedule for a website
export function updateWebsiteMonitoring(website: Website) {
  scheduleWebsiteMonitoring(website);
}

// Function to stop monitoring for a website
export function stopWebsiteMonitoring(websiteId: number) {
  if (monitoringIntervals.has(websiteId)) {
    clearInterval(monitoringIntervals.get(websiteId));
    monitoringIntervals.delete(websiteId);
    console.log(`Stopped monitoring for website ID ${websiteId}`);
  }
}

// Export for manual testing
export { checkWebsite, monitorWebsite };
