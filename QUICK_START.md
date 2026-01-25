# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Clone and Install

```bash
git clone https://github.com/vinzabe/Adaptive-Authentication-Engine-with-Auto-UAM-Escalation.git
cd Adaptive-Authentication-Engine-with-Auto-UAM-Escalation
```

Install dependencies:
```bash
cd worker && npm install
cd ../dashboard && npm install
```

### 2. Run Worker Backend

```bash
cd worker
npm run dev
```

The worker will start on `http://localhost:8787` (or another port)

### 3. Run Dashboard (New Terminal)

```bash
cd dashboard
npm run dev
```

The dashboard will start on `http://localhost:3000`

### 4. Test It Out

1. Open `http://localhost:3000` in your browser
2. Click "Sign up" and create an account
3. Login with your credentials
4. View the security dashboard with live metrics

### 5. Test API Directly

```bash
# Register a user
curl -X POST http://localhost:8787/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Check metrics
curl http://localhost:8787/api/metrics
```

## 📊 What You'll See

- **Real-time authentication tracking**
- **Risk scoring in action**
- **Threat detection metrics**
- **Interactive charts and graphs**
- **Top risk IPs table**

## 🛠️ What's Under the Hood

- **Worker**: Handles all authentication, risk assessment, and challenge routing
- **Dashboard**: React app that visualizes security metrics in real-time
- **KV Storage**: Simulated locally using Miniflare
- **Analytics**: Tracks every login attempt and calculates risk scores

## 🎯 Next Steps

1. **Configure Cloudflare**: Set up real KV namespaces and Turnstile
2. **Deploy to Production**: `wrangler deploy`
3. **Customize Risk Weights**: Adjust in `worker/src/scoring/risk-calculator.ts`
4. **Add More Features**: 2FA, SSO, passwordless auth
5. **Scale**: Deploy dashboard to Cloudflare Pages

## 📚 Learn More

- Full documentation: See [README.md](README.md)
- Build details: See [BUILD_SUMMARY.md](BUILD_SUMMARY.md)
- Implementation guide: See [IMPLEMENTATION.md](IMPLEMENTATION.md)

---

**Happy building! 🎉**