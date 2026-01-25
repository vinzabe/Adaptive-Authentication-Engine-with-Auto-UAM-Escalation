# Adaptive Authentication Engine with Auto-UAM Escalation

A production-grade, intelligent authentication system that detects threats in real-time and automatically escalates security challenges based on risk scores.

## ⭐ Features

- **Multi-layered Attack Detection**
  - Brute force attack detection
  - Credential stuffing detection
  - Geo-velocity analysis
  - Anomaly detection
  
- **Dynamic Risk Scoring**
  - Composite risk scoring algorithm
  - Weighted risk factors
  - Real-time risk assessment
  
- **Automatic UAM Escalation**
  - Cloudflare Turnstile integration
  - Managed challenges for high-risk requests
  - Adaptive challenge difficulty
  
- **Analytics Dashboard**
  - Real-time threat monitoring
  - Risk distribution charts
  - Top risk IPs tracking
  - Hourly attempt metrics
  
- **Multi-Authentication Support**
  - Form-based authentication
  - API key authentication
  - JWT token management
  
- **Zero Trust Security**
  - Device fingerprinting
  - Session management
  - Reputation tracking

## 🏗️ Architecture

```
┌─────────────────┐
│   User/Client   │
└────────┬────────┘
         │
    ┌────▼────────────────────────────────┐
    │  Cloudflare Edge Network            │
    │  ┌──────────────────────────────┐   │
    │  │  Cloudflare Worker           │   │
    │  │  (Authentication Engine)     │   │
    │  │                              │   │
    │  │  ├─ Request Handler          │   │
    │  │  ├─ Risk Detection Engine    │   │
    │  │  ├─ Scoring Algorithm        │   │
    │  │  └─ Challenge Router         │   │
    │  └──────────┬───────────────────┘   │
    └─────────────┼───────────────────────┘
                  │
    ┌─────────────┴───────────────────────┐
    │                                     │
┌───▼────────┐  ┌──────────┐  ┌─────────▼──────┐
│ KV Store   │  │ Analytics│  │ Turnstile/     │
│ (Sessions, │  │ Engine   │  │ Managed        │
│  Metrics)  │  │          │  │ Challenge      │
└────────────┘  └──────────┘  └────────────────┘
                     │
              ┌──────▼────────┐
              │ React Dashboard│
              │ (Admin Panel) │
              └───────────────┘
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Storage**: Cloudflare KV
- **Analytics**: Workers Analytics Engine
- **Security**: Cloudflare Turnstile + Managed Challenge

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State**: Zustand

## 📦 Installation

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI installed

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Adaptive-Authentication-Engine-with-Auto-UAM-Escalation
   ```

2. **Install dependencies**
   ```bash
   cd worker
   npm install
   
   cd ../dashboard
   npm install
   ```

3. **Configure Cloudflare**
   ```bash
   wrangler login
   wrangler kv:namespace create "SESSIONS"
   wrangler kv:namespace create "METRICS"
   wrangler kv:namespace create "RATE_LIMITS"
   wrangler kv:namespace create "USERS"
   ```

4. **Update wrangler.toml**
   Add the KV namespace IDs from the previous step.

5. **Run local development**
   ```bash
   # Terminal 1: Worker
   cd worker
   npm run dev
   
   # Terminal 2: Dashboard
   cd dashboard
   npm run dev
   ```

## 🚀 API Endpoints

### Authentication

#### POST /api/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

#### POST /api/login
Authenticate a user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "turnstileToken": "optional-challenge-token"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token",
  "message": "Login successful",
  "session": { ... }
}
```

#### POST /api/logout
Logout a user.

**Headers:**
```
Authorization: Bearer <token>
```

### User Management

#### GET /api/user
Get current user information.

**Headers:**
```
Authorization: Bearer <token>
```

#### POST /api/apikeys
Create a new API key.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "My API Key"
}
```

### Metrics

#### GET /api/metrics
Get security metrics.

**Response:**
```json
{
  "totalAttempts": 100,
  "successfulLogins": 80,
  "failedLogins": 20,
  "blockedAttempts": 5,
  "challengesIssued": 10,
  "challengeCompletions": 8,
  "riskScoreDistribution": {
    "low": 50,
    "medium": 30,
    "high": 15,
    "critical": 5
  },
  "topRiskIPs": [
    {
      "ip": "192.168.1.1",
      "score": 85,
      "attempts": 15
    }
  ]
}
```

## 🔐 Risk Scoring

The system calculates a composite risk score (0-100) based on:

1. **Brute Force (30%)**: Failed login attempts per IP
2. **Credential Stuffing (25%)**: Attacks across multiple accounts
3. **Geo-Velocity (20%)**: Impossible travel detection
4. **Anomaly (15%)**: Deviations from normal behavior
5. **Device Reputation (10%)**: Historical device behavior

**Risk Levels:**
- **Low (0-30)**: Allow access immediately
- **Medium (31-60)**: Require Turnstile challenge
- **High (61-85)**: Require Managed Challenge
- **Critical (86-100)**: Block access + alert

## 📊 Dashboard

Access the dashboard at `http://localhost:3000` after starting the development server.

### Features
- Real-time metrics
- Risk distribution charts
- Hourly attempt graphs
- Top risk IPs table
- Challenge statistics

## 🧪 Testing

```bash
# Run worker tests
cd worker
npm test

# Test authentication flow
curl -X POST http://localhost:8787/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## 🚀 Deployment

### Deploy Worker
```bash
cd worker
wrangler deploy
```

### Deploy Dashboard
```bash
cd dashboard
npm run build
# Upload dist/ to Cloudflare Pages or Netlify
```

## 📝 Configuration

### Environment Variables
- `JWT_SECRET`: Secret for JWT signing
- `TURNSTILE_SECRET`: Cloudflare Turnstile secret key
- `ALERT_WEBHOOK`: Webhook URL for security alerts
- `ENVIRONMENT`: development/production

### Risk Weights
Adjust risk factor weights in `worker/src/scoring/risk-calculator.ts`:
```typescript
const weights = {
  bruteForce: 0.30,
  credentialStuffing: 0.25,
  geoVelocity: 0.20,
  anomaly: 0.15,
  deviceReputation: 0.10
};
```

## 🛡️ Security Best Practices

1. Always use strong passwords
2. Enable 2FA in production
3. Rotate JWT secrets regularly
4. Monitor metrics dashboard
5. Set up alert webhooks for critical events
6. Keep dependencies updated
7. Use HTTPS in production
8. Implement proper CORS policies

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.