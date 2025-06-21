## 📧 Alert Email Conditions

### **1. Status Change Detection**
```typescript
const statusChanged = result.status !== website.lastStatus;
```
- ✅ **Website status must actually change** (not just a regular check)
- ✅ **Previous status ≠ Current status**

### **2. Specific Alert Types**

#### **🚨 DOWN Alert**
```typescript
if (result.status === 'down') {
  alertType = 'down';
  alertMessage = `Website is down. ${result.errorMessage ? `Error: ${result.errorMessage}` : 'No response from server.'}`;
  shouldSendAlert = true;
}
```
**Triggers when:**
- Website becomes unreachable
- HTTP request fails
- Connection timeout occurs
- Server returns error status codes

#### **✅ UP (Recovery) Alert**
```typescript
else if (result.status === 'up' && website.lastStatus === 'down') {
  alertType = 'up';
  alertMessage = `Website is back online. Response time: ${result.responseTime}ms`;
  shouldSendAlert = true;
}
```
**Triggers when:**
- Website was previously DOWN
- Website is now responding successfully
- **Only sends recovery alerts** (not when going from 'unknown' to 'up')

#### **⚠️ ERROR Alert**
```typescript
else if (result.status === 'error') {
  alertType = 'error';
  alertMessage = `Website error: ${result.errorMessage || 'Unknown error occurred'}`;
  shouldSendAlert = true;
}
```
**Triggers when:**
- DNS resolution fails
- Network errors occur
- SSL/TLS handshake fails
- Other connection errors

#### **➕ WEBSITE ADDED Alert**
```typescript
// Triggered when creating a new website
alertType = 'website_added';
alertMessage = `Website "${website.name}" (${website.url}) has been added to monitoring`;
```
**Triggers when:**
- New website is added to monitoring
- Website creation is successful
- Monitoring is initialized for the website

#### **🗑️ WEBSITE DELETED Alert**
```typescript
// Triggered when deleting a website
alertType = 'website_deleted';
alertMessage = `Website "${website.name}" (${website.url}) has been removed from WebMonitor monitoring.`;
```
**Triggers when:**
- Website is deleted from monitoring
- Monitoring is stopped for the website
- Website data is cleaned up 

## 📧 Email Content

**Subject Lines:**
- 🚨 **Down:** `🚨 Site Down Alert: [Website Name] ([URL])`
- ✅ **Up:** `✅ Site Up: [Website Name] ([URL])`
- ⚠️ **Error:** `⚠️ Site Error: [Website Name] ([URL])`
- ➕ **Added:** `➕ Website Added: [Website Name] ([URL])`
- 🗑️ **Deleted:** `🗑️ Website Removed: [Website Name] ([URL])`

**Content Includes:**
- Website name and URL
- Status message and timestamp
- Response time (if available)
- Error details (if applicable)
- Professional HTML formatting with color-coded status indicators

**Visual Indicators:**
- 🟢 **Green** - Online/Added (positive status)
- 🔴 **Red** - Offline (critical status)
- 🟡 **Yellow** - Error (warning status)
- 🔵 **Blue** - Added (informational status)
- 🟣 **Purple** - Deleted (informational status) 