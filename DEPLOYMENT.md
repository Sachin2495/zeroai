# Zero AI Interview System - Deployment Guide

Complete guide for deploying the Zero AI Interview application to production.

## 🏗️ Architecture

- **Frontend**: Next.js → Vercel
- **Backend**: FastAPI + ML models → Render (Docker)
- **Database**: MongoDB Atlas (recommended for production)

---

## 📋 Prerequisites

### Required Accounts
- [Vercel Account](https://vercel.com/signup) (Free tier works)
- [Render Account](https://render.com/register) (Starter plan recommended)
- [MongoDB Atlas Account](https://www.mongodb.com/cloud/atlas/register) (Free tier available)

### Required Tools
```bash
# Install Vercel CLI
npm install -g vercel

# Ensure Docker is installed (for local testing)
docker --version
```

### Required API Keys
- **Groq API Key**: Get from [https://console.groq.com](https://console.groq.com)
- **Hugging Face Token** (optional): Get from [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

---

## 🚀 Backend Deployment (Render)

### Step 1: Prepare MongoDB Database

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier M0 works fine)
3. Create a database user with password
4. Whitelist all IPs: `0.0.0.0/0` (for Render access)
5. Get your connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/agentic_interviewer
   ```

### Step 2: Deploy to Render

#### Option A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard** → [https://dashboard.render.com](https://dashboard.render.com)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `https://github.com/Sachin2495/zeroai`
   - Select the repository

3. **Configure Service**
   - **Name**: `zero-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Instance Type**: `Starter` ($7/month - recommended for ML models)

4. **Environment Variables**
   Click "Advanced" → Add environment variables:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/agentic_interviewer
   GROQ_API_KEY=your_groq_api_key_here
   HF_TOKEN=your_huggingface_token_here
   API_URL=https://zero-backend.onrender.com
   LLM_PROVIDER=groq
   PORT=8000
   ENVIRONMENT=production
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (first build takes ~10-15 minutes due to ML libraries)

6. **Get Backend URL**
   - After deployment, copy the URL: `https://zero-backend.onrender.com`
   - Test health endpoint: Visit `https://zero-backend.onrender.com/`
   - Expected response: `{"status":"online","system":"Zero Interviewer Engine"}`

#### Option B: Using Render Blueprint (render.yaml)

```bash
# From the backend directory
cd backend

# The render.yaml file is already configured
# Just go to Render Dashboard → Blueprints → New Blueprint Instance
# Connect your GitHub repo and it will auto-detect render.yaml
```

### Step 3: Verify Backend Deployment

```bash
# Test health endpoint
curl https://zero-backend.onrender.com/

# Expected output:
# {"status":"online","system":"Zero Interviewer Engine","architecture":"Class-Based","database":"MongoDB"}
```

---

## 🌐 Frontend Deployment (Vercel)

### Step 1: Update Backend URL

Edit `frontend/vercel.json` and replace the backend URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://zero-backend.onrender.com/api/:path*"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://zero-backend.onrender.com"
  }
}
```

### Step 2: Deploy with Vercel CLI

```bash
# Navigate to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow prompts:
# - Setup and deploy? Y
# - Which scope? Select your account
# - Link to existing project? N
# - Project name? zero-interview-frontend
# - Directory? ./ 
# - Override settings? N
```

### Step 3: Configure Environment Variables in Vercel

```bash
# Add backend URL via CLI
vercel env add NEXT_PUBLIC_API_URL production

# When prompted, enter: https://zero-backend.onrender.com
```

Or via Vercel Dashboard:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Settings → Environment Variables
4. Add:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://zero-backend.onrender.com`
   - **Environment**: Production

### Step 4: Redeploy

```bash
# Trigger new deployment with environment variables
vercel --prod
```

### Step 5: Get Frontend URL

After deployment completes, Vercel will provide your production URL:
```
https://zero-interview-frontend.vercel.app
```

---

## ✅ Verification

### Test Complete User Flow

1. **Visit Frontend URL**: https://zero-interview-frontend.vercel.app

2. **Landing Page**
   - ✅ Zero logo displays
   - ✅ Can select role dropdown
   - ✅ Can upload resume (PDF/DOCX)

3. **Start Interview**
   - ✅ Quiz questions load (backend API working)
   - ✅ Can answer questions
   - ✅ Score displays

4. **AI Interview**
   - ✅ Camera permission requested
   - ✅ AI greeting plays (speech synthesis)
   - ✅ Can speak responses (speech recognition)
   - ✅ AI responds with follow-up questions

5. **Report Generation**
   - ✅ Interview ends successfully
   - ✅ Report displays with score, strengths, weaknesses

### Check Browser Console

Press F12 → Console tab:
- ✅ No CORS errors
- ✅ No 404 API errors
- ✅ No authentication failures

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Render deployment fails with "Out of Memory"
- **Solution**: Upgrade to Starter plan ($7/mo) - ML models need more RAM

**Problem**: MongoDB connection timeout
- **Solution**: Check MongoDB Atlas IP whitelist includes `0.0.0.0/0`

**Problem**: Health check failing
- **Solution**: Ensure dockerfile HEALTHCHECK uses correct port (8000)

### Frontend Issues

**Problem**: API calls return 404
- **Solution**: Check `NEXT_PUBLIC_API_URL` environment variable in Vercel

**Problem**: CORS errors in browser console
- **Solution**: Backend CORS is set to allow all origins - verify backend is running

**Problem**: Logo not displaying
- **Solution**: Ensure `public/logo.png` exists in repository

### Local Testing with Docker

```bash
# Test backend locally before deploying
cd backend
docker-compose up --build

# Visit http://localhost:8000
# Should see: {"status":"online"}

# Stop containers
docker-compose down
```

---

## 📊 Cost Estimate

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel (Frontend) | Free | $0 |
| Render (Backend) | Starter | $7 |
| MongoDB Atlas | M0 Free Tier | $0 |
| **Total** | | **$7/month** |

**Note**: Render's free tier has limitations (spins down after inactivity, limited CPU/RAM). Starter plan recommended for production.

---

## 🔄 Continuous Deployment

Both Vercel and Render support auto-deployment:

- **Push to GitHub `main` branch** → Automatic redeployment
- Monitor deployments in respective dashboards
- Rollback available if deployment fails

---

## 📝 Environment Variables Summary

### Backend (Render)
```bash
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
HF_TOKEN=your_huggingface_token
API_URL=https://zero-backend.onrender.com
LLM_PROVIDER=groq
PORT=8000
ENVIRONMENT=production
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://zero-backend.onrender.com
```

---

## 🎉 Success!

Your Zero AI Interview System should now be live at:
- **Frontend**: https://zero-interview-frontend.vercel.app
- **Backend API**: https://zero-backend.onrender.com

Share the frontend URL with candidates to start conducting AI-powered interviews!
