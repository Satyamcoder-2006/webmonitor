# 🌐 WebWatchTower - Advanced Website Monitoring System

A comprehensive, real-time website monitoring platform built with modern web technologies. WebWatchTower provides enterprise-grade monitoring capabilities with beautiful analytics, instant alerts, and intelligent data management.

![WebWatchTower Dashboard](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-brightgreen)
![Database](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20TimescaleDB-blue)

## 🚀 Features

### 📊 **Real-Time Monitoring**
- **Individual Website Monitoring**: Each website has its own monitoring timer based on configurable check intervals
- **Multi-Status Detection**: Monitors for 'up', 'down', and 'error' states with detailed error reporting
- **SSL Certificate Monitoring**: Automatic SSL validity checks with expiry date tracking
- **Response Time Tracking**: Measures and logs response times for performance analysis
- **WebSocket Real-Time Updates**: Live status updates without page refresh

### 🔔 **Intelligent Alert System**
- **Status Change Detection**: Alerts only when website status actually changes (not on every check)
- **5-Minute Cooldown**: Prevents alert spam for the same website
- **Multiple Alert Types**:
  - 🚨 **Down Alerts**: When websites become unreachable
  - ✅ **Recovery Alerts**: When websites come back online
  - ⚠️ **Error Alerts**: For DNS, SSL, or network errors
  - ➕ **Website Added**: When new sites are added to monitoring
  - 🗑️ **Website Deleted**: When sites are removed from monitoring

### 📧 **Email Notifications**
- **Professional HTML Templates**: Beautiful, responsive email alerts
- **Multiple Email Providers**: Support for Gmail, SMTP, and custom email services
- **Rich Content**: Includes website details, status, response time, and error messages
- **Color-Coded Status**: Visual indicators for different alert types

### 📈 **Advanced Analytics**
- **Real-Time Metrics**: Uptime percentage, response times, downtime events
- **Time-Range Analysis**: 24h, 7d, 30d, 90d views
- **Performance Charts**: Interactive charts using Recharts
- **SSL Analytics**: Expiring certificates tracking
- **Tag-Based Analytics**: Group and analyze websites by custom tags
- **Individual Website Analytics**: Detailed performance data per website

### 🏷️ **Website Management**
- **Custom Tags**: Organize websites with custom tags for better management
- **Flexible Check Intervals**: Configurable monitoring frequency per website
- **Bulk Operations**: Add, edit, and manage multiple websites efficiently
- **Search & Filter**: Advanced filtering by name, URL, and tags

### 💾 **Data Management**
- **TimescaleDB Integration**: Time-series database for efficient monitoring data storage
- **Automatic Compression**: Data compression after 7 days for storage optimization
- **Retention Policies**: Configurable data retention (default: 90 days)
- **Data Archiving**: Intelligent data management with compression schedules

### 🎨 **Modern UI/UX**
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Dark/Light Mode**: Beautiful theme switching
- **Glass Morphism**: Modern glass-card design with subtle transparency
- **Real-Time Updates**: Live status changes without page refresh
- **Interactive Components**: Rich UI with tooltips, modals, and animations

## 🏗️ Architecture

### **Frontend Stack**
- **React 18.3.1** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with custom glass morphism design system
- **Radix UI** for accessible, unstyled components
- **React Query (TanStack Query)** for server state management
- **React Router** for client-side routing
- **Recharts** for beautiful data visualizations
- **Lucide React** for consistent iconography

### **Backend Stack (Microservices Architecture)**
- **Main Server**: Node.js with Express.js framework (Port 5000)
  - Handles API endpoints, authentication, real-time monitoring, and serves the React frontend
  - Manages website monitoring, alerts, and user interface
- **Archiver Service**: Dedicated microservice (Port 6001)
  - Handles batch processing of monitoring logs
  - Efficiently stores high-volume monitoring data
  - Separates data archival from main application logic
- **TypeScript** for type-safe server-side code
- **PostgreSQL** with TimescaleDB extension for time-series data
- **Drizzle ORM** for type-safe database operations
- **WebSocket** for real-time communication
- **Nodemailer** for email notifications
- **Zod** for runtime type validation

### **Database Schema**
```sql
-- Core tables with TimescaleDB hypertables
websites (id, url, name, email, check_interval, is_active, ssl_valid, ssl_expiry_date, custom_tags)
monitoring_logs (id, website_id, status, http_status, response_time, checked_at, change_type)
alerts (id, website_id, alert_type, message, sent_at, email_sent, read)
tags (id, name)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+ with TimescaleDB extension
- npm or yarn package manager

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd WebWatchTower
```

2. **Install dependencies**
```bash
# Install main application dependencies
npm install

# Install archiver service dependencies
cd archiver-service
npm install
cd ..
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/webwatchtower

# Email Configuration (Gmail example)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FROM_EMAIL=noreply@yourdomain.com

# Or SMTP Configuration
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
```

4. **Set up the database**
```bash
# Create database
npm run db:create

# Run migrations
npm run migrate

# Add test data (optional)
npm run db:test-data
```

5. **Start the backend services**

**Option A: Start both services in separate terminals**

Terminal 1 (Main Server):
```bash
npm run dev
```

Terminal 2 (Archiver Service):
```bash
cd archiver-service
npm start
```

**Option B: Start both services using a process manager (recommended for production)**
```bash
# Install PM2 globally if you haven't already
npm install -g pm2

# Start both services
pm2 start server/index.ts --name "webwatchtower-main" --interpreter tsx
pm2 start archiver-service/src/index.ts --name "webwatchtower-archiver" --interpreter tsx

# Monitor services
pm2 status
pm2 logs
```

The application will be available at:
- **Main Application**: `http://localhost:5000`
- **Archiver Service**: `http://localhost:6001` (API endpoint for batch log processing)

## 📋 Available Scripts

```bash
# Development
npm run dev              # Start main development server (Port 5000)
npm run dev:unix         # Start main development server (Unix systems)

# Archiver Service
cd archiver-service
npm start               # Start archiver service (Port 6001)
npm run dev             # Start archiver service in development mode

# Database Management
npm run db:generate      # Generate database migrations
npm run db:push          # Push schema changes to database
npm run migrate          # Run database migrations
npm run db:create        # Create database
npm run db:drop          # Drop all tables
npm run db:test-data     # Add sample data

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run check            # TypeScript type checking
```

## 🔧 Configuration

### **Service Ports**
- **Main Server**: Port 5000 (serves API and frontend)
- **Archiver Service**: Port 6001 (handles batch log processing)

### **Monitoring Settings**
- **Default Check Interval**: 60 minutes (configurable per website)
- **SSL Check Timeout**: 10 seconds
- **HTTP Request Timeout**: 30 seconds
- **Alert Cooldown**: 5 minutes between alerts for the same website

### **Data Retention**
- **Compression Interval**: 7 days (data older than 7 days is compressed)
- **Retention Period**: 90 days (data older than 90 days is deleted)
- **Compression Schedule**: Daily automatic compression jobs
- **Retention Schedule**: Daily automatic cleanup jobs

### **Email Configuration**
The system supports multiple email providers:

**Gmail (Recommended for testing):**
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Custom SMTP:**
```env
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
```

## 📊 Monitoring Logic

### **Status Detection**
1. **UP**: HTTP 200-299 response within timeout
2. **DOWN**: Connection timeout, refused connection, or HTTP 4xx/5xx errors
3. **ERROR**: DNS resolution failure, SSL errors, or network issues

### **Alert Triggers**
- **Status Change**: Only alerts when status actually changes
- **Cooldown Period**: 5-minute minimum between alerts for same website
- **Recovery Detection**: Automatically detects when sites come back online

### **SSL Monitoring**
- **Certificate Validation**: Checks SSL certificate validity
- **Expiry Tracking**: Monitors certificate expiration dates
- **Days Remaining**: Calculates days until certificate expires

## 🎨 UI Components

### **Design System**
- **Glass Morphism**: Modern glass-card design with backdrop blur
- **Color Scheme**: Consistent color palette with dark/light mode support
- **Typography**: Clean, readable fonts with proper hierarchy
- **Spacing**: Consistent spacing system using Tailwind's spacing scale

### **Key Components**
- **Dashboard**: Real-time overview with metrics and website table
- **Analytics**: Interactive charts and performance data
- **Alerts**: Comprehensive alert management with filtering
- **Settings**: Website configuration and system settings
- **Tags**: Custom tag management for website organization

## 🔒 Security Features

- **Input Validation**: Zod schemas for all API endpoints
- **SQL Injection Protection**: Drizzle ORM with parameterized queries
- **XSS Prevention**: React's built-in XSS protection
- **CORS Configuration**: Proper CORS setup for API endpoints
- **Environment Variables**: Secure configuration management

## 📈 Performance Optimizations

- **Database Indexing**: Optimized indexes for monitoring queries
- **Data Compression**: Automatic compression of old monitoring data
- **Caching**: React Query for efficient data fetching and caching
- **Lazy Loading**: Code splitting for better initial load times
- **WebSocket**: Real-time updates without polling

## 🧪 Testing

The project includes comprehensive testing capabilities:

```bash
# Run type checking
npm run check

# Test email functionality
node test-email-features.js

# Database testing
npm run db:test-data
```

## 🚀 Deployment

### **Vercel Deployment**
The project includes `vercel.json` for easy deployment to Vercel:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "node",
  "installCommand": "npm install"
}
```

### **Environment Setup**
Ensure all environment variables are configured in your deployment platform:
- `DATABASE_URL`
- `EMAIL_USER` / `EMAIL_PASS` or SMTP configuration
- `FROM_EMAIL`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TimescaleDB** for time-series database capabilities
- **Drizzle ORM** for type-safe database operations
- **Radix UI** for accessible component primitives
- **Tailwind CSS** for the utility-first CSS framework
- **React Query** for efficient server state management

---

**Built with ❤️ using modern web technologies**

*WebWatchTower - Your websites, monitored with precision and style.* 