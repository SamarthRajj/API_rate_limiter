# Getting Started Guide

## Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Simulator
cd ../simulator
pip install -r requirements.txt
```

### Step 2: Start Services

**Terminal 1 - Redis:**
```bash
docker run -p 6379:6379 --name redis -d redis:7
```

**Terminal 2 - MongoDB:**
```bash
# If you have MongoDB installed locally, it should be running
# Or sign up for MongoDB Atlas and get a connection string
```

**Terminal 3 - Backend:**
```bash
cd backend
# Make sure .env has correct MONGO_URI and Redis settings
npm run dev
```

**Terminal 4 - Frontend:**
```bash
cd frontend
npm start
```

### Step 3: Create First Admin Account

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Step 4: Open Dashboard

Navigate to `http://localhost:3000`

### Step 5: Create API Clients

Two ways to create clients:

**Option A: Via Admin Panel (Recommended)**
1. Go to Admin Panel tab
2. Click "Login" and use credentials: `admin` / `admin123`
3. Click "Create Client"
4. Fill in: Name, Per Minute Limit (e.g., 10), Per Day Limit (e.g., 1000)
5. Copy the generated API key

**Option B: Via API**
```bash
curl -X POST http://localhost:5000/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"TestClient","perMinuteLimit":10,"perDayLimit":1000}'
```

### Step 6: Run Load Simulator

Update `simulator/clients_config.json` with your API keys, then:

```bash
cd simulator
python simulator_load.py --config-file clients_config.json --pattern spike --duration 60
```

### Step 7: Watch Real-time Dashboard

Go back to `http://localhost:3000` and watch:
- Real-time request counters updating
- Charts showing allowed vs blocked requests
- Alert indicators when approaching limits

## Features Overview

### Dashboard Tab
- **Live metrics**: Total requests, allowed, blocked
- **Client overview**: Current usage with progress bars
- **Real-time charts**: Per-second and cumulative usage
- **Status indicators**: Healthy, Warning, Critical

### Admin Panel Tab
- **Create clients**: Generate new API keys
- **Edit clients**: Update limits and names
- **Toggle status**: Enable/disable clients
- **Regenerate keys**: Create new API key
- **Delete clients**: Remove clients permanently

### Analytics Tab
- **Summary cards**: Overall statistics
- **Alert cards**: Warnings for high usage
- **Success rate charts**: Visual analytics
- **Export CSV**: Download usage data

### API Documentation
Visit `http://localhost:5000/api-docs` for interactive Swagger documentation.

## Common Tasks

### Test Rate Limiting

```bash
# Replace with your actual API key
API_KEY="your_api_key_here"

# Send 20 requests quickly (should hit rate limit)
for i in {1..20}; do
  curl -H "x-api-key: $API_KEY" http://localhost:5000/api/data
  echo ""
done
```

### Update Client Limits

1. Go to Admin Panel
2. Login if not already logged in
3. Click edit icon on the client row
4. Update limits
5. Click "Update"

### Export Usage Data

1. Go to Analytics tab
2. Click "Export CSV" button
3. Open the downloaded file in Excel/Sheets

### Monitor in Real-time

1. Open Dashboard tab
2. Run simulator in terminal
3. Watch metrics update live
4. Check charts for visual patterns

## Troubleshooting

### Dashboard shows no data
- Check if backend is running on port 5000
- Verify MongoDB is connected
- Ensure at least one client exists

### Simulator shows errors
- Verify API keys are correct
- Check that backend is accessible
- Make sure you created clients first

### Admin panel login fails
- Make sure you registered an admin user
- Verify username/password are correct
- Check backend logs for errors

## Next Steps

1. **Production Setup**: Review `README.md` deployment section
2. **Security**: Change JWT secret in `.env`
3. **Monitoring**: Set up log aggregation
4. **Testing**: Run comprehensive load tests
5. **Documentation**: Review API docs at `/api-docs`

## Key Endpoints

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **API Docs**: http://localhost:5000/api-docs
- **Test Endpoint**: http://localhost:5000/api/data (requires API key)

## Support

- Check `README.md` for comprehensive documentation
- Review API documentation at `/api-docs`
- Check backend logs for detailed error messages
- Verify environment variables in `.env`

---

**Enjoy your rate limiter! 🚀**

