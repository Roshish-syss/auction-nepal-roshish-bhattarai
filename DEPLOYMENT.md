# Deploy backend on Render + frontend on Vercel

## 1. Deploy the API on Render

### Option A — Blueprint (this repo includes `render.yaml`)

1. In [Render](https://render.com), go to **New** → **Blueprint**.
2. Connect the GitHub repo and select the branch (e.g. `main`).
3. Render reads `render.yaml` and creates a **Web Service** with root directory `backend`.
4. In the service **Environment** tab, add **all** variables from `backend/.env.example` (at minimum `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`).
5. Deploy and wait until the service is **Live**. Note the public URL, e.g. `https://auction-nepal-api.onrender.com`.

### Option B — Web Service manually

1. **New** → **Web Service** → connect the repo.
2. **Root Directory:** `backend`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. **Health Check Path:** `/api/health`
6. Add the same environment variables as in `backend/.env.example`.

### Render environment checklist

| Variable | Notes |
|----------|--------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Strong random string (access tokens) |
| `JWT_REFRESH_SECRET` | Different strong string (refresh tokens) |
| `FRONTEND_URL` | Your Vercel URL(s), comma-separated. Put the **production** URL first if you list several (used in password-reset links). |
| Cloudinary / email vars | Only if you use those features |

**CORS:** `FRONTEND_URL` must include the exact origin users use in the browser (scheme + host, no path). Example: `https://auction-nepal-roshish-bhattarai.vercel.app`.

**API base URL for the frontend:** your Render host + `/api` path prefix used by this project:

```text
https://<your-service-name>.onrender.com/api
```

## 2. Point Vercel at Render

In the Vercel project → **Settings** → **Environment Variables** (Production):

| Name | Value |
|------|--------|
| `REACT_APP_API_URL` | `https://<your-service-name>.onrender.com/api` |

Redeploy the frontend so the build picks up `REACT_APP_API_URL`. The React app uses this as the axios `baseURL` for all `/auth/...`, `/users/...`, etc.

## 3. Keep Vercel serverless API or not

This repo can still run a bundled API on Vercel (`api/index.js`). If you use **only** Render for the backend:

- Set `REACT_APP_API_URL` on Vercel as above so the browser calls Render.
- You can leave Vercel rewrites as they are; unused `/api/*` hits on Vercel are optional to remove later.

## 4. Socket.IO (live auctions, chat)

`backend/server.js` runs Socket.IO on the **same** Render Web Service as HTTP. The frontend must connect the socket client to the **Render origin without `/api`**, e.g. `https://<your-service>.onrender.com`, if your client is configured that way. Ensure `FRONTEND_URL` on Render includes your Vercel origin so Socket.IO CORS accepts the browser.

## 5. Smoke test

- `GET https://<render-host>/api/health` → `{"status":"OK",...}`
- Register/login from the Vercel URL and confirm network requests go to the Render host.
