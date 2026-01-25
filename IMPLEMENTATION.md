# Adaptive Authentication Engine - Implementation Notes

## Quick Start

This project is a full-featured adaptive authentication system with:
- Cloudflare Workers backend
- React dashboard
- Multi-layered threat detection
- Automatic challenge escalation
- Real-time analytics

## Development

### Worker Development
```bash
cd worker
npm install
npm run dev
```

The worker will run on `http://localhost:8787`

### Dashboard Development
```bash
cd dashboard
npm install
npm run dev
```

The dashboard will run on `http://localhost:3000`

## Testing Locally

1. Start the worker: `cd worker && npm run dev`
2. Start the dashboard: `cd dashboard && npm run dev`
3. Open http://localhost:3000
4. Register a new account
5. Login and view the dashboard

## Key Files

### Worker
- `worker/src/index.ts` - Main entry point
- `worker/src/handlers/auth.ts` - Authentication logic
- `worker/src/handlers/risk.ts` - Risk assessment engine
- `worker/src/detection/*` - Threat detection modules
- `worker/src/scoring/*` - Risk scoring algorithms

### Dashboard
- `dashboard/src/pages/Dashboard.tsx` - Main dashboard
- `dashboard/src/stores/*` - State management
- `dashboard/src/components/*` - UI components

## Deployment

After testing locally, deploy to production:
```bash
cd worker
wrangler deploy

cd ../dashboard
npm run build
# Deploy dist/ to your hosting platform
```