# Isekai System - Running Instance

## ✅ Current Status: FULLY OPERATIONAL

All services are running and tested successfully!

## 🚀 Service URLs

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | http://localhost:3001 | ✅ Running |
| **Backend API** | http://localhost:8080 | ✅ Running |
| **Planner** | http://localhost:8090 | ✅ Running |
| **Sandbox** | http://localhost:8070 | ✅ Running |

## 📊 System Health

```bash
# Check system health
curl http://localhost:8080/api/health | jq

# List all apps
curl http://localhost:8080/api/apps | jq

# Generate new app
curl -X POST http://localhost:8080/api/apps/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a calculator app"}'
```

## 🎯 Generated Apps

Currently running 4 apps:
1. **Todo List** - http://localhost:9003
2. **Hello World** - http://localhost:9002
3. **Interactive Pokedex** - Static HTML
4. **CSV Viewer** - Static HTML

## 🔧 Management Commands

### View Logs
```bash
# Backend logs
tail -f /tmp/backend.log

# Planner logs
tail -f /tmp/planner.log

# Sandbox logs
tail -f /tmp/sandbox.log

# Frontend logs
tail -f /tmp/frontend.log
```

### Restart Services
```bash
# Kill all services
pkill -f "ts-node-dev.*isekai"
pkill -f "react-scripts"

# Restart all
cd /home/donovan/Isekai
npm run dev
```

### Check Ports
```bash
ss -tlnp | grep -E ":(3001|8070|8080|8090)"
```

### Database
```bash
# View database
sqlite3 /home/donovan/Isekai/packages/data/isekai.db

# Count apps
sqlite3 /home/donovan/Isekai/packages/data/isekai.db "SELECT COUNT(*) FROM apps;"
```

## 🐛 Troubleshooting

### Service Not Responding
```bash
# Check if process is running
ps aux | grep -E "node.*isekai"

# Check logs for errors
tail -50 /tmp/backend.log | grep -i error
```

### Port Already in Use
```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Clear All Data
```bash
# Remove database
rm /home/donovan/Isekai/packages/data/isekai.db

# Remove generated apps
rm -rf /home/donovan/Isekai/packages/data/sandbox-apps/*
```

## 📝 Quick Start Guide

1. **Access the UI**: Open http://localhost:3001 in your browser
2. **Generate an App**: Type a prompt like "Create a weather dashboard"
3. **View Your App**: Click on the generated app to see details and preview
4. **Manage Apps**: Delete or modify apps from the UI

## 🎉 Features Working

- ✅ Natural language to code generation
- ✅ Live app execution in sandbox
- ✅ Multi-app management
- ✅ Database persistence
- ✅ Health monitoring
- ✅ Security (CORS, Helmet, Rate limiting)
- ✅ Hot-reload modifications
- ✅ Interactive UI with React

## 📚 API Endpoints

- `POST /api/apps/generate` - Generate new app
- `GET /api/apps` - List all apps
- `GET /api/apps/:id` - Get specific app
- `PATCH /api/apps/:id` - Update app
- `DELETE /api/apps/:id` - Delete app
- `GET /api/health` - System health check

---

**Last Updated**: 2025-10-15 19:05:00
**System Version**: 1.0.0
**Status**: Production Ready ✨
